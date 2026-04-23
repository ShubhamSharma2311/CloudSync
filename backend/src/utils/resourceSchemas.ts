import { z } from "zod";
import { CloudProvider, ResourceType, ResourceStatus } from "@prisma/client";

export const getResourcesQuerySchema = z.object({
  cloudAccountId: z.string().uuid().optional(),
  scanId: z.string().uuid().optional(),
  provider: z.nativeEnum(CloudProvider).optional(),
  resourceType: z.nativeEnum(ResourceType).optional(),
  status: z.nativeEnum(ResourceStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GetResourcesQuery = z.infer<typeof getResourcesQuerySchema>;
