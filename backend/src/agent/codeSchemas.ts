import { z } from "zod";

// Each finding maps 1:1 to a row in the code_proposals table.
export const codeFindingSchema = z.object({
  filePath: z.string(),
  lineNumber: z.number().int().min(1),
  pattern: z.string().min(1).max(64), // SCREAMING_SNAKE_CASE label
  description: z.string().min(1),
  suggestion: z.string().min(1),
  costCategory: z.enum(["LOW", "MEDIUM", "HIGH"]),
  billingCorrelationUsd: z.number().min(0),
  confidenceScore: z.number().int().min(0).max(100),
});

export type CodeFinding = z.infer<typeof codeFindingSchema>;

export const codeAgentResultSchema = z.object({
  findings: z.array(codeFindingSchema),
  summaryNote: z.string(),
});

export type CodeAgentResult = z.infer<typeof codeAgentResultSchema>;

export const codeAgentGeminiSchema = {
  type: "object",
  required: ["findings", "summaryNote"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        required: [
          "filePath",
          "lineNumber",
          "pattern",
          "description",
          "suggestion",
          "costCategory",
          "billingCorrelationUsd",
          "confidenceScore",
        ],
        properties: {
          filePath: { type: "string" },
          lineNumber: { type: "integer", minimum: 1 },
          pattern: { type: "string" },
          description: { type: "string" },
          suggestion: { type: "string" },
          costCategory: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          billingCorrelationUsd: { type: "number" },
          confidenceScore: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
    },
    summaryNote: { type: "string" },
  },
};
