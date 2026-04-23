import { z } from "zod";

export const cloudProviderSchema = z.enum(["AWS", "GCP", "AZURE"]);
export const connectionStatusSchema = z.enum([
  "UNKNOWN",
  "VERIFIED",
  "INVALID",
  "REVOKED",
]);

export const createCloudAccountSchema = z.object({
  provider: cloudProviderSchema,
  externalAccountId: z.string().trim().min(1).max(128),
  displayName: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(64).optional(),
  credentialsCiphertextBase64: z.string().trim().min(1),
  credentialsMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const listCloudAccountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  provider: cloudProviderSchema.optional(),
  connectionStatus: connectionStatusSchema.optional(),
});

export const verifyCloudAccountParamsSchema = z.object({
  cloudAccountId: z.string().uuid(),
});

export const verifyCloudAccountBodySchema = z
  .object({
    actorId: z.string().trim().min(1).max(120).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .default({});

export type CreateCloudAccountPayload = z.infer<typeof createCloudAccountSchema>;
export type ListCloudAccountsQuery = z.infer<typeof listCloudAccountsQuerySchema>;
export type VerifyCloudAccountParams = z.infer<typeof verifyCloudAccountParamsSchema>;
export type VerifyCloudAccountPayload = z.infer<typeof verifyCloudAccountBodySchema>;
