import { z } from "zod";
import { cloudProviderSchema } from "./cloudAccountSchemas";

export const scanTriggerSchema = z.enum([
  "MANUAL",
  "SCHEDULED",
  "EVENT_WEBHOOK",
  "DEMO",
]);

export const createScanSchema = z.object({
  cloudAccountId: z.string().uuid(),
  trigger: scanTriggerSchema.default("MANUAL"),
  startedAt: z.coerce.date().optional(),
});

export const listScansQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cloudAccountId: z.string().uuid().optional(),
    provider: cloudProviderSchema.optional(),
    trigger: scanTriggerSchema.optional(),
    startedFrom: z.coerce.date().optional(),
    startedTo: z.coerce.date().optional(),
  })
  .refine(
    (value) => {
      if (!value.startedFrom || !value.startedTo) {
        return true;
      }

      return value.startedFrom <= value.startedTo;
    },
    {
      message: "startedFrom must be earlier than or equal to startedTo",
      path: ["startedFrom"],
    }
  );

export type CreateScanPayload = z.infer<typeof createScanSchema>;
export type ListScansQuery = z.infer<typeof listScansQuerySchema>;
