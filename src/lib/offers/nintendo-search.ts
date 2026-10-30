import { parseStoreUrl } from "../domain";
import { HttpError } from "../api-errors";

export type NintendoSearchResult = {
  store: "nintendo";
  title: string;
  id: string;
  url: string;
  platform?: string;
};

const applicationId = "U3B6GR4UA3";
// Public search-only key embedded in Nintendo's AR storefront bundle; it can rotate with that bundle.
const searchOnlyKey = "a29c6927638bfd8cee23993e51e721c9";
const attributesToRetrieve = [
  "title",
  "url",
  "urlKey",
  "platform",
  "platformCode",
  "topLevelCategoryCode",
  "eshopDetails.productType",
  "isUpgrade",
  "dlcType",
  "visibleInSearch",
  "objectID",
];

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function platform(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/^(?:Nintendo )?Switch 2$/i.test(value.trim())) return "Switch 2";
  if (/^(?:Nintendo )?Switch$/i.test(value.trim())) return "Switch";
  return undefined;
}

export function parseNintendoSearchResults(
  value: unknown,
): NintendoSearchResult[] {
  const hits = object(value).hits;
  if (!Array.isArray(hits)) throw new Error("Invalid Nintendo search response");
  const results: NintendoSearchResult[] = [];
  for (const item of hits) {
    if (results.length >= 10) break;
    const hit = object(item);
    const details = object(hit.eshopDetails);
    const title =
      typeof hit.title === "string"
        ? hit.title.replace(/\s+/g, " ").trim()
        : "";
    const urlKey = typeof hit.urlKey === "string" ? hit.urlKey : "";
    if (
      hit.topLevelCategoryCode !== "GAMES" ||
      details.productType !== "TITLE" ||
      hit.isUpgrade === true ||
      hit.visibleInSearch === false ||
      !title ||
      title.length > 300 ||
      !/^[A-Za-z0-9-]{1,200}$/.test(urlKey)
    )
      continue;
    try {
      const sourceUrl = new URL(
        typeof hit.url === "string" ? hit.url : "",
        "https://www.nintendo.com",
      );
      const identity = parseStoreUrl(sourceUrl.href);
      if (
        sourceUrl.origin !== "https://www.nintendo.com" ||
        identity.store !== "nintendo" ||
        identity.region !== "AR" ||
        identity.product !== urlKey
      )
        continue;
      if (results.some((result) => result.id === urlKey)) continue;
      results.push({
        store: "nintendo",
        title,
        id: urlKey,
        url: identity.url,
        ...(platform(hit.platform) ? { platform: platform(hit.platform) } : {}),
      });
    } catch {
      continue;
    }
  }
  return results;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error("Nintendo search unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty Nintendo search response");
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1_000_000) throw new Error("Nintendo response too large");
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export async function searchNintendoTitles(
  term: string,
  requestSignal?: AbortSignal,
): Promise<NintendoSearchResult[]> {
  const query = term.trim();
  if (query.length < 2 || query.length > 100)
    throw new HttpError("VALIDATION", "Escribí entre 2 y 100 caracteres.", 400);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000);
  try {
    const response = await fetch(
      "https://u3b6gr4ua3-dsn.algolia.net/1/indexes/store_game_es_ar/query",
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-algolia-application-id": applicationId,
          "x-algolia-api-key": searchOnlyKey,
        },
        body: JSON.stringify({
          query,
          hitsPerPage: 30,
          analytics: false,
          clickAnalytics: false,
          attributesToRetrieve,
        }),
      },
    );
    return parseNintendoSearchResults(await boundedJson(response));
  } catch {
    throw new HttpError(
      "TEMPORARY",
      "No se pudieron buscar juegos en Nintendo. Reintentá o completá el juego manualmente.",
      503,
    );
  }
}
