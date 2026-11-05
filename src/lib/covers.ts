import { z } from "zod";
import type { Cover } from "./types";
export type { Cover } from "./types";

export const COVER_IMAGE_HOSTS = [
  "shared.akamai.steamstatic.com",
  "shared.fastly.steamstatic.com",
  "assets.nintendo.com",
  "applescoop.org",
  "bfasset.costco-static.com",
  "boulanger.scene7.com",
  "cdn.awsli.com.br",
  "cdn.cloudflare.steamstatic.com",
  "cdn.mobygames.com",
  "cdn.mos.cms.futurecdn.net",
  "divinity.com",
  "down-my.img.susercontent.com",
  "ecommerce.datablitz.com.ph",
  "gameplay.com.co",
  "gaming-cdn.com",
  "http2.mlstatic.com",
  "i.ebayimg.com",
  "i5.walmartimages.com",
  "imagenes.hobbyconsolas.com",
  "images.artandgungame.com",
  "images.ctfassets.net",
  "images.inkl.com",
  "images.launchbox-app.com",
  "img.youtube.com",
  "justpressplayonline.com",
  "media.gamatomic.com",
  "media.gamestop.com",
  "media.karousell.com",
  "miro.medium.com",
  "multimedia.bbycastatic.ca",
  "pnpdistribution.com",
  "retrogamefan.com",
  "retronorthgames.com",
  "rimage.ripley.com.pe",
  "s13emagst.akamaized.net",
  "shared.steamstatic.com",
  "storage.googleapis.com",
  "superretro.com.au",
  "tbcgames.com",
  "videogamesplus.ca",
  "www.japanzon.com",
  "www.kjell.com",
  "www.nintendo.com",
  "www.powerupgaming.ca",
  "www.pressstart.pt",
  "www.staples-3p.com",
  "www.switchscores.com",
  "www.tinyrobotonline.com",
  "www.videodivari.fi",
  "www.videogameschronicle.com",
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
}) satisfies z.ZodType<Cover>;

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
