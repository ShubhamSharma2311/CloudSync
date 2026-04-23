import { z } from "zod";

export const proposalStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RESOLVED",
  "EXPIRED",
]);

export const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const listProposalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cloudAccountId: z.string().uuid().optional(),
  scanId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  status: proposalStatusSchema.optional(),
  severity: severitySchema.optional(),
  expiresBefore: z.coerce.date().optional(),
  expiresAfter: z.coerce.date().optional(),
});

export const proposalDecisionParamsSchema = z.object({
  proposalId: z.string().uuid(),
});

export const proposalDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  actorId: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
export type ProposalDecisionParams = z.infer<typeof proposalDecisionParamsSchema>;
export type ProposalDecisionPayload = z.infer<typeof proposalDecisionSchema>;
