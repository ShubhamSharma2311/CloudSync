import { GoogleGenAI } from "@google/genai";
import type { Resource, SecurityPolicy } from "@prisma/client";
import { loadConfig } from "../config/env";
import { getLogger } from "../utils/logger";
import { ProviderError } from "../utils/errors";
import {
  type AgentProposal,
  agentProposalGeminiSchema,
  agentProposalSchema,
} from "./schemas";

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const config = loadConfig();
  cachedClient = new GoogleGenAI({ apiKey: config.VERTEX_API_KEY });
  return cachedClient;
}

// Gemini intermittently returns 503 (high demand) and 429 (per-minute rate
// limit). Both are transient and worth retrying. 4xx auth/permission errors
// are NOT retried — they will never resolve themselves.
async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  const logger = getLogger();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retriable = status === 503 || status === 429 || status === 500;
      if (!retriable || attempt === maxAttempts) throw err;
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 250);
      logger.warn({ attempt, status, delayMs }, "Gemini transient error — retrying");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

const SYSTEM_PROMPT = `You are CloudSync, an autonomous cloud security and cost auditor.

Your job: given (1) a single cloud resource snapshot and (2) the security/compliance rules that apply to it, decide whether the resource has a problem worth flagging. If yes, produce a complete proposal that explains the problem clearly, justifies its severity, and tells a non-expert exactly how to fix it — both as a runnable command AND as a step-by-step walkthrough.

What counts as a "problem worth flagging":
A. The resource violates one of the input rules (cite the ruleId).
B. The resource's observedStatus is ZOMBIE, BREACH, or UNCERTAIN — these are pre-classified findings:
   - ZOMBIE → unused/idle resource burning money. Issue type ZOMBIE_RESOURCE. Propose deletion or scale-down. Estimate savings from costMonthlyUsd. citedRuleIds=[].
   - BREACH → security incident or compliance violation. Issue type from context (e.g. PUBLIC_STORAGE, INSECURE_IAM). Propose immediate lockdown. Cite the matching CIS rule if any.
   - UNCERTAIN → ambiguous signal in rawMetadata. Issue type INVESTIGATION_NEEDED. Propose a check/audit action with lower confidenceScore (40-60).
C. Right-sizing opportunity from rawMetadata.metrics30d (the 30-day usage window from the cloud's monitoring API):
   - **CPU under-utilized**: cpu.avgPct < 5% AND cpu.peakPct < 25% over the window → recommend a smaller instance class (e.g. m5.large → t3.medium).
   - **Memory over-allocated**: memory.peakBytes / memory.allocatedBytes < 0.35 → recommend smaller memory tier. Lambda 3072→256MB, EC2 8GB→2GB, etc.
   - **Idle-pattern compute** (activeHoursPerDay < 4): suggest serverless or spot/scheduled.
   - **Lambda cold-start over-allocation**: avg < 30% of allocated memory → drop allocated; cite ~12x cost difference at 256MB vs 3072MB.
   - **DB FreeStorageBytes > 60% of allocated** for 30+ days → suggest reducing allocated storage.
   - **Cache evictions=0 AND memory used < 40%** → smaller cache instance.

D. **Memory data missing on a raw VM**: if metrics30d is present but memory is omitted AND the resource is COMPUTE provider=AWS/GCP/AZURE (raw VM, not RDS/Lambda/Cloud-Run/etc.), the customer has not installed the metrics agent (CloudWatch Agent / Ops Agent / Azure Monitor Agent). Surface this as an INVESTIGATION_NEEDED proposal at MEDIUM severity with humanReadableSteps explaining how to install the agent, so future scans can recommend memory-based right-sizing. Set confidenceScore around 60 since the VM may legitimately need its current size.

OUTPUT REQUIREMENTS — each field has a specific job, fill them all when shouldFlag=true:

1. **title** (≤120 chars): one-line headline a busy engineer can grok. Include resource name. Example: "EC2 'api-worker-legacy' has been idle for 30+ days — terminate to save $78/mo".

2. **description** (3-5 sentences, plain prose): WHAT is wrong. Reference the concrete numbers from rawMetadata that prove it. Example: "The EC2 instance 'api-worker-legacy' (i-0demoapi01) in us-east-1 has averaged 1.2% CPU utilization over the last 30 days, with no inbound network traffic since 2026-04-05. Its m5.large size costs $78/mo regardless of utilization. The 'env=staging' tag suggests this was a development workload that was forgotten after the team migrated."

3. **whyItMatters** (2-4 sentences): the CONSEQUENCE if ignored. Cost impact, security blast radius, compliance risk, operational debt. Example: "At $78/mo this instance bleeds ~$940/year. Multiplied across the 5–10 zombies a typical mid-sized AWS account accumulates, this pattern alone often hides $5–10K of annual waste. Beyond cost, idle instances still receive security patches at boot — meaning unused EC2s are unpatched longer than active ones, widening your attack surface."

4. **humanReadableSteps** (4-8 short instructions, each one numbered as plain text): exact click-by-click or command-by-command path a junior SRE can follow without prior context. Reference the actual resource ID and region. Each step under 200 chars.
   Example for an EC2 termination:
   - "1. Sign in to the AWS Console and switch to the us-east-1 region."
   - "2. Navigate to EC2 → Instances and search for 'i-0demoapi01'."
   - "3. Confirm the instance shows ≥30 days of <2% CPU on the Monitoring tab before proceeding."
   - "4. (Recommended) Right-click → Image and templates → Create image, to keep a recoverable snapshot for 30 days."
   - "5. Right-click the instance → Instance state → Terminate instance. Confirm in the dialog."
   - "6. Verify in Cost Explorer 24h later that the line item for i-0demoapi01 has dropped to $0."

5. **remediationCode** (runnable code, no prose): Terraform HCL preferred, AWS/GCP/Azure CLI acceptable. Multi-line is fine. This is what an automation pipeline would execute.

6. **citedRuleIds**: EXACT ruleId values from the input rule list — never invent. Empty array if no rule applies but a cost/status issue still merits flagging.

7. **issueType**: short SCREAMING_SNAKE_CASE label, e.g. ZOMBIE_RESOURCE, OVERPROVISIONED, INSECURE_IAM, PUBLIC_STORAGE, MISSING_ENCRYPTION, INVESTIGATION_NEEDED.

8. **estimatedSavingsUsd**: monthly USD saved IF the proposal is applied. Use costMonthlyUsd if provided. 0 for pure security findings with no cost component.

9. **confidenceScore**: 90+ when rawMetadata or observedStatus directly proves the issue. 70-89 for strong inference, 40-69 for weak inference, <40 only when essentially guessing.

10. **severity**: matches the violated rule's severity. For non-rule-based flags: MEDIUM by default, HIGH if monthly cost is >$50, CRITICAL if the resource is publicly exposed AND production-tagged.

If shouldFlag=false, fill ALL fields with empty defaults: empty strings, empty arrays, 0 numbers, severity=LOW.`;

const SAFE_RULE_FIELDS = (rule: Pick<SecurityPolicy, "ruleId" | "title" | "severity" | "content" | "policySource">) => ({
  ruleId: rule.ruleId,
  source: rule.policySource,
  severity: rule.severity,
  title: rule.title,
  content: rule.content.slice(0, 1200),
});

const SAFE_RESOURCE_FIELDS = (
  resource: Pick<Resource, "provider" | "providerResourceId" | "resourceType" | "name" | "region" | "status" | "costMonthly" | "rawMetadata" | "tags">
) => ({
  provider: resource.provider,
  resourceType: resource.resourceType,
  name: resource.name,
  providerId: resource.providerResourceId,
  region: resource.region,
  observedStatus: resource.status,
  costMonthlyUsd: resource.costMonthly?.toString() ?? null,
  rawMetadata: resource.rawMetadata,
  tags: resource.tags,
});

export async function analyzeResource(
  resource: Resource,
  rules: SecurityPolicy[],
  options?: { highStakes?: boolean }
): Promise<AgentProposal> {
  const config = loadConfig();
  const logger = getLogger();
  const client = getClient();

  const model = options?.highStakes
    ? config.GEMINI_MODEL_HIGH_STAKES
    : config.GEMINI_MODEL_DEFAULT;

  const userPayload = {
    resource: SAFE_RESOURCE_FIELDS(resource),
    applicableRules: rules.map(SAFE_RULE_FIELDS),
  };

  const start = Date.now();
  let responseText: string;
  let usage: unknown;
  try {
    const result = await callWithRetry(() =>
      client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(userPayload, null, 2) }],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: agentProposalGeminiSchema,
          temperature: 0.1,
        },
      })
    );
    responseText = result.text ?? "";
    usage = result.usageMetadata;
  } catch (err) {
    logger.error({ err, resourceId: resource.id, model }, "gemini call failed");
    throw new ProviderError("Gemini analysis failed", {
      provider: "GEMINI",
      model,
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    logger.error({ resourceId: resource.id, responseText }, "gemini returned non-JSON");
    throw new ProviderError("Gemini returned non-JSON output", {
      provider: "GEMINI",
      model,
      sample: responseText.slice(0, 200),
    });
  }

  const validation = agentProposalSchema.safeParse(parsed);
  if (!validation.success) {
    logger.error(
      { resourceId: resource.id, issues: validation.error.issues },
      "gemini output failed schema validation"
    );
    throw new ProviderError("Gemini output failed schema validation", {
      provider: "GEMINI",
      model,
      issues: validation.error.issues,
    });
  }

  logger.info(
    {
      resourceId: resource.id,
      model,
      durationMs: Date.now() - start,
      usage,
      shouldFlag: validation.data.shouldFlag,
      confidenceScore: validation.data.confidenceScore,
    },
    "analyzeResource complete"
  );

  return validation.data;
}
