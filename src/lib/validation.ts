import { z } from "zod";
const numberOrNull = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();
export const recordSchema = z.object({
  id: z.uuid().optional(),
  gameId: z.uuid().optional(),
  title: z.string().trim().min(1).max(300),
  year: numberOrNull(1950, 2200),
  platforms: z.string().max(2000),
  device: z.string().max(200),
  period: z.string().max(100),
  started: z.string().max(100),
  finished: z.string().max(100),
  status: z.enum([
    "backlog",
    "playing",
    "completed",
    "paused",
    "abandoned",
    "remembered",
    "wishlist",
    "upcoming",
  ]),
  ownership: z.string().max(100),
  priority: numberOrNull(0, 100),
  hype: z.string().max(100),
  hours: numberOrNull(0, 100000),
  estimated: z.string().max(200),
  rating: numberOrNull(0, 100),
  memorability: numberOrNull(0, 10),
  impression: z.string().max(200),
  focus: z.string().max(100),
  replay: z.string().max(100),
  reason: z.string().max(20000),
  notes: z.string().max(50000),
  sourceKey: z.string().max(1000),
  updated_at: z.string().optional(),
});
export async function bodyJson(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw Error("Carga demasiado grande");
  const text = await request.text();
  if (text.length > 5_000_000) throw Error("Carga demasiado grande");
  return JSON.parse(text);
}
