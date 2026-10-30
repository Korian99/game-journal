import { load } from "cheerio";
import { HttpError } from "../api-errors";

export type StoreSearchResult = {
  store: "steam";
  title: string;
  id: string;
  url: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseSteamSearchResults(value: unknown): StoreSearchResult[] {
  const response = record(value);
  if (
    ![1, true].includes(response.success as number | boolean) ||
    typeof response.results_html !== "string"
  )
    throw new Error("Invalid Steam search response");

  const $ = load(response.results_html);
  const results: StoreSearchResult[] = [];
  $("a.search_result_row").each((_, element) => {
    if (results.length >= 10) return;
    const row = $(element);
    const rawId = row.attr("data-ds-appid") ?? "";
    const title = row.find(".title").first().text().replace(/\s+/g, " ").trim();
    if (!/^\d+$/.test(rawId) || !title || title.length > 300) return;
    const appId = Number(rawId);
    if (!Number.isSafeInteger(appId) || appId <= 0) return;
    try {
      const href = new URL(row.attr("href") ?? "");
      const match = href.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
      if (
        href.protocol !== "https:" ||
        href.hostname !== "store.steampowered.com" ||
        href.port ||
        href.username ||
        href.password ||
        !match ||
        match[1] !== rawId
      )
        return;
    } catch {
      return;
    }
    const id = String(appId);
    if (results.some((result) => result.id === id)) return;
    results.push({
      store: "steam",
      title,
      id,
      url: `https://store.steampowered.com/app/${id}/`,
    });
  });
  return results;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error("Steam search unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty Steam search response");
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1_000_000) throw new Error("Steam response too large");
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export async function searchSteamTitles(
  term: string,
  requestSignal?: AbortSignal,
): Promise<StoreSearchResult[]> {
  const query = term.trim();
  if (query.length < 2 || query.length > 100)
    throw new HttpError("VALIDATION", "Escribí entre 2 y 100 caracteres.", 400);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000);
  try {
    const url = new URL("https://store.steampowered.com/search/results/");
    url.search = new URLSearchParams({
      term: query,
      category1: "998",
      count: "10",
      start: "0",
      infinite: "1",
      l: "spanish",
      cc: "AR",
    }).toString();
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal,
      headers: { "User-Agent": "GameJournal/1.0" },
    });
    return parseSteamSearchResults(await boundedJson(response));
  } catch {
    throw new HttpError(
      "TEMPORARY",
      "No se pudieron buscar juegos en Steam. Reintentá o completá el juego manualmente.",
      503,
    );
  }
}
