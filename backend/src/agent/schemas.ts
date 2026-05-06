import { z } from "zod";

// What Gemini returns per (resource, rules) analysis. Gemini enforces this
// shape server-side via responseSchema; we re-validate with zod as defense
// in depth (the structured-output mode is reliable but not 100% guaranteed,
// especially when the model hits unusual edge cases).
export const agentProposalSchema = z
  .object({
    shouldFlag: z.boolean(),
    issueType: z.string().max(64),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    title: z.string().max(200),
    description: z.string(),
    citedRuleIds: z.array(z.string()),
    remediationCode: z.string(),
    estimatedSavingsUsd: z.number().min(0),
    confidenceScore: z.number().int().min(0).max(100),
  })
  // When shouldFlag is true, the agent MUST give us a usable proposal — no
  // empty strings. When false, empty defaults are explicitly allowed.
  .superRefine((p, ctx) => {
    if (!p.shouldFlag) return;
    if (!p.issueType.trim()) {
      ctx.addIssue({ code: "custom", path: ["issueType"], message: "Required when shouldFlag=true" });
    }
    if (!p.title.trim()) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "Required when shouldFlag=true" });
    }
    if (!p.description.trim()) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Required when shouldFlag=true" });
    }
  });

export type AgentProposal = z.infer<typeof agentProposalSchema>;

// Gemini responseSchema (subset of OpenAPI 3.0 schema) — must match the zod
// shape above. Gemini will refuse to return anything that doesn't conform.
export const agentProposalGeminiSchema = {
  type: "object",
  required: [
    "shouldFlag",
    "issueType",
    "severity",
    "title",
    "description",
    "citedRuleIds",
    "remediationCode",
    "estimatedSavingsUsd",
    "confidenceScore",
  ],
  properties: {
    shouldFlag: { type: "boolean" },
    issueType: { type: "string" },
    severity: {
      type: "string",
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
    title: { type: "string" },
    description: { type: "string" },
    citedRuleIds: { type: "array", items: { type: "string" } },
    remediationCode: { type: "string" },
    estimatedSavingsUsd: { type: "number" },
    confidenceScore: { type: "integer", minimum: 0, maximum: 100 },
  },
};
