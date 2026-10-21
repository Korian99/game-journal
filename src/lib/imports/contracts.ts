import { z } from "zod";
import { journalEntrySchema } from "../contracts";
export const importRecordSchema = z.intersection(
  journalEntrySchema,
  z.object({
    links: z.array(z.string()).optional(),
    raw: z.record(z.string(), z.unknown()).optional(),
  }),
);
export const importBatchSchema = z.object({
  batchId: z.uuid(),
  plan: z.array(
    z.object({
      incoming: importRecordSchema,
      id: z.string().optional(),
      expectedUpdatedAt: z.string().optional(),
      kind: z.enum(["add", "update", "conflict", "unchanged"]),
      changes: z.record(z.string(), z.unknown()),
      conflicts: z.array(z.string()),
    }),
  ),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;
