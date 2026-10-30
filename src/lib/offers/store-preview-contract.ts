import { z } from "zod";
import { releaseSchema } from "../validation";

// Only fields the stores can supply. Personal playthrough fields stay untouched.
export const storePreviewSchema = z.object({
  url: z.url(),
  additionalPages: z.array(z.url()).max(1).optional(),
  store: z.enum(["steam", "nintendo"]),
  region: z.string().length(2),
  checkedAt: z.iso.datetime(),
  fields: z.object({
    title: z.string().trim().min(1).max(300),
    platforms: z.string().max(2000).optional(),
    release: releaseSchema.optional(),
    year: z.number().int().min(1950).max(2200).optional(),
  }),
  quote: z.object({
    name: z.string().optional(),
    status: z.string(),
    price: z.number().finite().nonnegative().nullable(),
    regular: z.number().finite().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    discount: z.number().min(0).max(100),
    release: z.string().optional(),
  }),
});
export type StorePreview = z.infer<typeof storePreviewSchema>;
