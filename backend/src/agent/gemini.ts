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

Your job: given (1) a single cloud resource snapshot and (2) the security/compliance rules that apply to it, decide whether the resource has a problem worth flagging, and if so propose a single, targeted remediation.

What counts as a "problem worth flagging":
A. The resource violates one of the input rules (cite the ruleId).
B. The resource's observedStatus is ZOMBIE, BREACH, or UNCERTAIN — these are pre-classified findings:
   - ZOMBIE → unused/idle resource burning money. Issue type ZOMBIE_RESOURCE. Propose deletion or scale-down. Estimate savings from costMonthlyUsd. Cite no rules (zombie detection is cost-driven, not CIS-driven) — citedRuleIds=[].
   - BREACH → security incident or compliance violation. Issue type from rule context (e.g. PUBLIC_STORAGE, INSECURE_IAM). Propose immediate lockdown. Cite the matching CIS rule if any.
   - UNCERTAIN → ambiguous signal in rawMetadata. Issue type INVESTIGATION_NEEDED. Propose a check/audit action with lower confidenceScore (40-60).
C. Strong evidence in rawMetadata of waste (e.g. memory_mb=3072 with avg_used_mb=120 is OVERPROVISIONED) even when no explicit rule covers it.

Rules of engagement:
1. Set citedRuleIds to EXACT ruleId values from the input rule list — never invent. Empty array if no rule applies but a cost/status issue still merits flagging.
2. issueType is a short SCREAMING_SNAKE_CASE label, e.g. ZOMBIE_RESOURCE, OVERPROVISIONED, INSECURE_IAM, PUBLIC_STORAGE, MISSING_ENCRYPTION, INVESTIGATION_NEEDED.
3. remediationCode must be a runnable snippet — Terraform HCL preferred, AWS/GCP/Azure CLI acceptable. Never prose.
4. estimatedSavingsUsd is monthly USD saved IF the proposal is applied. Use costMonthlyUsd if provided. Set 0 for pure security findings with no cost component.
5. confidenceScore: 90+ when rawMetadata or observedStatus directly proves the issue. 70-89 for strong inference, 40-69 for weak inference, <40 only when essentially guessing.
6. severity matches the violated rule's severity. For non-rule-based flags (zombie/over-provisioned): MEDIUM by default, HIGH if monthly cost is >$50, CRITICAL if the resource is publicly exposed AND production-tagged.
7. If shouldFlag=false, fill all fields with empty defaults: empty strings, empty arrays, 0 numbers, severity=LOW.`;

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
