import { z } from "zod";
import { notificationSchema } from "../contracts";
const cursorSchema = z.object({
  at: z
    .string()
    .regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/),
  id: z.uuid(),
});
export function notificationQuery(params: URLSearchParams) {
  const read = z.enum(["all", "unread"]).parse(params.get("read") ?? "all");
  const kind = z
    .enum(["", "discount", "target", "release", "test"])
    .parse(params.get("kind") ?? "");
  const raw = params.get("cursor");
  if (raw && raw.length > 300) throw Error("Cursor inválido.");
  return {
    read,
    kind,
    cursor: raw ? cursorSchema.parse(JSON.parse(raw)) : null,
  };
}
export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string(),
});
export function notificationPage(
  rows: unknown[],
  unreadCount: number,
  checkedAt: string,
) {
  const items = z.array(notificationSchema).parse(rows).slice(0, 25),
    last = items.at(-1);
  return {
    items,
    unreadCount,
    nextCursor:
      rows.length > 25 && last
        ? JSON.stringify({ at: last.created_at, id: last.id })
        : null,
    checkedAt,
  };
}
