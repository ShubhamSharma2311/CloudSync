import { z } from "zod";

export const cloudProviderSchema = z.enum(["AWS", "GCP", "AZURE"]);
export const resourceTypeSchema = z.enum(["COMPUTE", "STORAGE", "IDENTITY", "SERVERLESS"]);
export const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const listPoliciesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  provider: cloudProviderSchema.optional(),
  resourceType: resourceTypeSchema.optional(),
  severity: severitySchema.optional(),
  source: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListPoliciesQuery = z.infer<typeof listPoliciesQuerySchema>;
