import { z } from "zod";

export const COVER_IMAGE_HOSTS = [
  "shared.akamai.steamstatic.com",
  "shared.fastly.steamstatic.com",
  "assets.nintendo.com",
] as const;

export const coverImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .transform((value, ctx) => {
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        !COVER_IMAGE_HOSTS.includes(
          url.hostname as (typeof COVER_IMAGE_HOSTS)[number],
        ) ||
        url.port ||
        url.username ||
        url.password
      ) {
        ctx.addIssue({ code: "custom", message: "Unsupported cover URL" });
        return z.NEVER;
      }
      return url.href;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid cover URL" });
      return z.NEVER;
    }
  })
  .pipe(z.string().max(2000));

export const coverSchema = z.object({
  providerUrl: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    coverImageUrlSchema.optional(),
  ),
  overrideUrl: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    coverImageUrlSchema.optional(),
  ),
  provider: z.enum(["steam", "nintendo"]).optional(),
});

export type Cover = z.infer<typeof coverSchema>;

export function parseCoverImageUrl(value: unknown): string | undefined {
  const result = coverImageUrlSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function effectiveCoverUrl(cover: unknown): string | undefined {
  const parsed = coverSchema.safeParse(cover);
  if (!parsed.success) return undefined;
  return parsed.data.overrideUrl ?? parsed.data.providerUrl;
}

export function mergeProviderCover(
  existing: unknown,
  incoming: unknown,
): Cover | undefined {
  const current = coverSchema.safeParse(existing);
  const kept = current.success ? current.data : undefined;
  if (kept?.providerUrl) return kept;
  const next = coverSchema.safeParse(incoming);
  if (!next.success || !next.data.providerUrl)
    return kept?.overrideUrl ? kept : undefined;
  return {
    providerUrl: next.data.providerUrl,
    provider: next.data.provider,
    ...(kept?.overrideUrl ? { overrideUrl: kept.overrideUrl } : {}),
  };
}
