import { z } from "zod";
import { emptyRecord } from "./types";
import { statusSchema } from "./journal/status-schema";
import type { JournalEntry } from "./journal/journal-types";
const text = z.string(),
  optionalText = text.nullish().transform((value) => value ?? "");
const nullableNumber = z.number().finite().nullable();
export const memberSchema = z.object({
  id: text.optional(),
  display_name: text,
  role: z.enum(["admin", "member"]),
  active: z.boolean().optional(),
});
export type Member = z.infer<typeof memberSchema>;
export const journalEntrySchema = z
  .object({
    id: text.optional(),
    gameId: text.optional(),
    title: text,
    year: nullableNumber.optional(),
    release: text.optional(),
    platforms: text.optional(),
    device: text.optional(),
    period: text.optional(),
    started: optionalText,
    finished: optionalText,
    status: statusSchema,
    ownership: text.optional(),
    priority: z.union([z.number(), text, z.null()]).optional(),
    hype: text.optional(),
    hours: nullableNumber.optional(),
    estimated: text.optional(),
    rating: nullableNumber.optional(),
    memorability: nullableNumber.optional(),
    impression: text.optional(),
    focus: text.optional(),
    replay: text.optional(),
    reason: text.optional(),
    notes: text.optional(),
    sourceKey: text.optional(),
    sourceSnapshot: z.record(text, z.unknown()).optional(),
    updated_at: text.optional(),
    pages: z.array(text).optional(),
  })
  .transform((entry): JournalEntry => ({ ...emptyRecord, ...entry }));
export const offerSchema = z.object({
  id: text,
  game_id: text,
  url: text,
  store: text,
  region: text,
  currency: text.nullable(),
  price: nullableNumber,
  regular_price: nullableNumber,
  discount: z.number().finite(),
  status: text,
  checked_at: text.nullable(),
  last_success_at: text.nullable().optional(),
  error: text.nullable(),
  watched: z.boolean(),
  target_price: nullableNumber,
});
export const offersSchema = z.array(offerSchema);
export const recordsResponseSchema = z.object({
  records: z.array(journalEntrySchema),
  member: memberSchema.nullable(),
  offers: offersSchema.optional(),
});
export const grantSchema = z.object({
  id: text,
  entry_id: text,
  recipient_id: text,
  owner_id: text.optional(),
});
export type ShareGrant = z.infer<typeof grantSchema>;
export const sharingMemberSchema = memberSchema
  .pick({ id: true, display_name: true })
  .required({ id: true });
export type SharingMember = z.infer<typeof sharingMemberSchema>;
export const sharedEntrySchema = z.object({
  shareId: text,
  owner: text,
  title: text,
  period: optionalText,
  device: optionalText,
  status: optionalText,
  hours: nullableNumber,
  rating: nullableNumber,
  memorability: nullableNumber,
  impression: optionalText,
  focus: optionalText,
  replay: optionalText,
});
export const sharingResponseSchema = z.object({
  shared: z.array(sharedEntrySchema),
  members: z.array(sharingMemberSchema),
  grants: z.array(grantSchema),
});
export type SharingData = z.infer<typeof sharingResponseSchema>;
export const notificationSchema = z.object({
  id: text,
  title: text,
  body: text,
  created_at: text,
  read_at: text.nullable(),
  url: text.default("/?tab=wishlist"),
  kind: z.enum(["discount", "target", "release", "test"]).default("discount"),
  game_id: text.nullable().optional(),
  offer_id: text.nullable().optional(),
});
export const notificationsSchema = z.array(notificationSchema);
export type JournalNotification = z.infer<typeof notificationSchema>;
export const priceHistorySchema = z.array(
  z.object({
    id: text,
    created_at: text,
    currency: text,
    price: z.number().finite(),
    discount: z.number().finite(),
  }),
);
export type PriceHistory = z.infer<typeof priceHistorySchema>;
export const invitationSchema = z.object({ link: z.string().url() });
export const saveResponseSchema = z.object({
  id: text,
  gameId: text,
  record: journalEntrySchema.optional(),
  revision: z.string().optional(),
});
