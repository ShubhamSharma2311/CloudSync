// The "code-cost" agent: a separate Gemini-backed agent specialized in
// reading serverless source code and identifying patterns that drive up
// runtime cost. Distinct from the infrastructure agent in agent/gemini.ts —
// different prompt, different output schema, different concern.

import { GoogleGenAI } from "@google/genai";
import type { Resource } from "@prisma/client";
import { loadConfig } from "../config/env";
import { getLogger } from "../utils/logger";
import { ProviderError } from "../utils/errors";
import {
  type CodeAgentResult,
  codeAgentGeminiSchema,
  codeAgentResultSchema,
} from "./codeSchemas";

let cachedClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const config = loadConfig();
  cachedClient = new GoogleGenAI({ apiKey: config.VERTEX_API_KEY });
  return cachedClient;
}

const SYSTEM_PROMPT = `You are CloudSync's code-cost auditor — a specialist agent that reviews serverless function source code (AWS Lambda, GCP Cloud Run / Cloud Functions, Azure Functions) for cost-impacting anti-patterns.

Your input:
1. The full source file of one function.
2. The function's runtime characteristics: monthly invocations, p50/p95 duration, allocated memory, runtime version.

Your job: identify code patterns that increase billable execution time, memory usage, cold-start frequency, or upstream API costs. For each finding, estimate monthly USD impact using the invocation count.

Anti-pattern catalog (use these labels exactly in 'pattern'):
- COLD_START_HEAVY_IMPORT: a heavyweight library imported at module scope but not used on every invocation. Inflates cold-start time.
- DB_CONNECTION_NOT_REUSED: SDK clients (DynamoDB, S3, RDS, etc.) instantiated inside the handler instead of at module scope. Defeats Lambda's container reuse.
- N_PLUS_ONE_QUERIES: SDK call inside a loop where a batch operation exists (BatchGetItem, BatchWriteItem, mget, multi-row insert).
- STORAGE_CALLS_IN_LOOP: GetObject/PutObject/etc. inside a loop where a single multipart or batched call would suffice.
- SYNC_AWAIT_IN_PARALLEL_OPPORTUNITY: independent awaits in sequence that could run via Promise.all to halve wall time.
- NO_PAGINATION_LIMIT: unbounded scan/list/query that loads more than needed.
- MEMORY_LOADED_FULL_DATASET: pulling a whole file/table into memory then filtering in code; cheaper to filter at the data store.
- MISSING_HTTP_KEEPALIVE: outbound fetches without a keep-alive HTTPS Agent — TCP+TLS handshake on every call.
- MISSING_TIMEOUT: external call has no timeout — slow upstream stalls the whole instance.
- MISSING_CACHING: repeated lookup or computation without memoization.
- BLOCKING_IO_AFTER_RESPONSE: side-effect work (email, logs, analytics) awaited before returning instead of fire-and-forget.

Severity rubric for billingCorrelationUsd estimation:
- Multiply the per-invocation overhead (extra ms or extra MB) by the monthly invocation count and the function's per-GB-second cost. Lambda is ~$0.0000166667 per GB-second. Cloud Run is ~$0.00002400 per GB-second.
- Be honest: if you can't estimate confidently, set a low number (e.g. $5) and lower confidenceScore.
- HIGH cost = >$50/mo. MEDIUM = $10-50/mo. LOW = <$10/mo.

Output rules:
1. filePath: copy the input filePath verbatim.
2. lineNumber: the EXACT line where the pattern starts (1-indexed). Use the line numbers shown in the input — they're real.
3. description: 2-3 sentences explaining what the code is doing wrong.
4. suggestion: a SPECIFIC code change. Include short code snippets where helpful (e.g. "Replace the for-loop with: ddb.send(new BatchGetItemCommand({ RequestItems: { orders: { Keys } } }))"). No vague advice.
5. costCategory + billingCorrelationUsd must be internally consistent.
6. If the file has no anti-patterns, return findings:[] and a summaryNote explaining why the code looks good.
7. confidenceScore: 90+ when the pattern is unambiguously present and you can quantify the impact. Lower when guessing.`;

const SAFE_RESOURCE_FIELDS = (resource: Resource) => {
  const meta = (resource.rawMetadata as Record<string, unknown> | null) ?? {};
  const metrics30d = (meta["metrics30d"] as Record<string, unknown> | null) ?? {};
  return {
    provider: resource.provider,
    resourceType: resource.resourceType,
    name: resource.name,
    runtime: meta["runtime"] ?? null,
    instanceSpec: meta["instanceSpec"] ?? null,
    monthlyInvocations: (metrics30d["serverless"] as Record<string, unknown> | null)?.["invocations"] ?? null,
    p50DurationMs: (metrics30d["serverless"] as Record<string, unknown> | null)?.["p50DurationMs"] ?? null,
    p95DurationMs: (metrics30d["serverless"] as Record<string, unknown> | null)?.["p95DurationMs"] ?? null,
    allocatedMemoryMb:
      (meta["instanceSpec"] as Record<string, unknown> | null)?.["allocatedMemoryMb"] ??
      (meta["instanceSpec"] as Record<string, unknown> | null)?.["memoryMb"] ??
      null,
    costMonthlyUsd: resource.costMonthly?.toString() ?? null,
  };
};

const numberLines = (source: string): string =>
  source
    .split("\n")
    .map((line, i) => `${(i + 1).toString().padStart(4, " ")} | ${line}`)
    .join("\n");

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

export async function analyzeCode(
  resource: Resource,
  filePath: string,
  sourceText: string
): Promise<CodeAgentResult> {
  const config = loadConfig();
  const logger = getLogger();
  const client = getClient();

  const userPayload = {
    filePath,
    resourceContext: SAFE_RESOURCE_FIELDS(resource),
    sourceWithLineNumbers: numberLines(sourceText),
  };

  const start = Date.now();
  let responseText: string;
  let usage: unknown;
  try {
    const result = await callWithRetry(() =>
      client.models.generateContent({
        model: config.GEMINI_MODEL_DEFAULT,
        contents: [{ role: "user", parts: [{ text: JSON.stringify(userPayload, null, 2) }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: codeAgentGeminiSchema,
          temperature: 0.1,
        },
      })
    );
    responseText = result.text ?? "";
    usage = result.usageMetadata;
  } catch (err) {
    logger.error({ err, resourceId: resource.id, filePath }, "code agent call failed");
    throw new ProviderError("Code agent analysis failed", {
      provider: "GEMINI",
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new ProviderError("Code agent returned non-JSON output", {
      provider: "GEMINI",
      sample: responseText.slice(0, 200),
    });
  }

  const validation = codeAgentResultSchema.safeParse(parsed);
  if (!validation.success) {
    logger.error(
      { resourceId: resource.id, issues: validation.error.issues },
      "code agent output failed schema validation"
    );
    throw new ProviderError("Code agent output failed schema validation", {
      provider: "GEMINI",
      issues: validation.error.issues,
    });
  }

  logger.info(
    {
      resourceId: resource.id,
      filePath,
      durationMs: Date.now() - start,
      usage,
      findingCount: validation.data.findings.length,
    },
    "analyzeCode complete"
  );

  return validation.data;
}
