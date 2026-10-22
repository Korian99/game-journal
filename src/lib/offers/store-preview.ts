import { load } from "cheerio";
import { parseNintendo, parseSteam, parseStoreUrl } from "../domain";
import { HttpError } from "../api-errors";
import { parseRelease } from "../releases";
import {
  storePreviewSchema,
  type StorePreview,
} from "./store-preview-contract";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
const months = [
  ["jan", "january", "ene", "enero"],
  ["feb", "february", "febrero"],
  ["mar", "march", "marzo"],
  ["apr", "april", "abr", "abril"],
  ["may", "mayo"],
  ["jun", "june", "junio"],
  ["jul", "july", "julio"],
  ["aug", "august", "ago", "agosto"],
  ["sep", "sept", "september", "septiembre"],
  ["oct", "october", "octubre"],
  ["nov", "november", "noviembre"],
  ["dec", "december", "dic", "diciembre"],
];
function releaseFields(
  value: unknown,
): Pick<StorePreview["fields"], "release" | "year"> {
  const raw = text(value);
  let normalized = raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) normalized = raw.slice(0, 10);
  if (parseRelease(normalized).kind === "unknown") {
    const tokens = raw
      .toLowerCase()
      .replaceAll(",", "")
      .replaceAll(".", "")
      .split(/\s+/)
      .filter((v) => v !== "de");
    const month = months.findIndex((names) => names.includes(tokens[0]));
    const dayFirstMonth = months.findIndex((names) =>
      names.includes(tokens[1]),
    );
    const year = tokens[2];
    const day = month >= 0 ? tokens[1] : tokens[0];
    const monthIndex = month >= 0 ? month : dayFirstMonth;
    if (
      tokens.length === 3 &&
      monthIndex >= 0 &&
      /^\d{4}$/.test(year) &&
      /^\d{1,2}$/.test(day)
    )
      normalized =
        year +
        "-" +
        String(monthIndex + 1).padStart(2, "0") +
        "-" +
        day.padStart(2, "0");
  }
  const parsed = parseRelease(normalized);
  return parsed.kind === "unknown"
    ? {}
    : { release: parsed.value, year: parsed.year };
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const host = new URL(url).hostname;
  for (let redirects = 0; redirects < 4; redirects++) {
    const target = new URL(url);
    if (
      target.protocol !== "https:" ||
      target.hostname !== host ||
      target.port ||
      target.username ||
      target.password
    )
      throw Error("Redirección de tienda rechazada");
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal,
      headers: { "User-Agent": "GameJournal/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw Error("Redirección inválida");
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw Error("Tienda no disponible");
    }
    // Bound decompressed data too; Content-Length can be absent or compressed.
    const reader = response.body?.getReader();
    if (!reader) throw Error("Respuesta vacía");
    const decoder = new TextDecoder();
    let size = 0,
      body = "";
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 8_000_000) throw Error("Página demasiado grande");
        body += decoder.decode(next.value, { stream: true });
      }
      return body + decoder.decode();
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
  throw Error("Demasiadas redirecciones");
}
function nintendoMetadata(html: string, url: string) {
  const $ = load(html),
    target = parseStoreUrl(url);
  const nodes: Record<string, unknown>[] = [];
  function collect(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const node = object(value);
    if (Object.keys(node).length) nodes.push(node);
    if (node["@graph"]) collect(node["@graph"]);
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      collect(JSON.parse($(element).text()));
    } catch {}
  });
  const products = nodes.filter((node) =>
    [node["@type"]]
      .flat()
      .some((type) =>
        ["VideoGame", "Product", "SoftwareApplication"].includes(String(type)),
      ),
  );
  const selected = products.find((node) => {
    const offer = object(
      Array.isArray(node.offers) ? node.offers[0] : node.offers,
    );
    const candidate = node.url ?? offer.url;
    if (!candidate) return products.length === 1;
    try {
      const identity = parseStoreUrl(new URL(String(candidate), url).href);
      return (
        identity.product === target.product && identity.region === target.region
      );
    } catch {
      return false;
    }
  });
  if (!selected) throw Error("No se encontró el producto solicitado");
  const platforms = [selected.gamePlatform]
    .flat()
    .map((value) => text(value))
    .map((value) =>
      /^(?:Nintendo )?Switch 2$/i.test(value)
        ? "Nintendo Switch 2"
        : /^(?:Nintendo )?Switch$/i.test(value)
          ? "Nintendo Switch"
          : "",
    )
    .filter(Boolean);
  let release: unknown = selected.datePublished ?? selected.releaseDate;
  if (!release) {
    $("h2,h3,dt").each((_, element) => {
      if (
        /^(release date|fecha de lanzamiento|fecha de estreno|fecha de salida)$/i.test(
          $(element).text().trim(),
        )
      )
        release = $(element).next().text().trim();
    });
  }
  return {
    title: text(selected.name),
    ...(platforms.length
      ? { platforms: [...new Set(platforms)].join("; ") }
      : {}),
    ...releaseFields(release),
  };
}
export async function loadStorePreview(
  rawUrl: string,
  requestSignal?: AbortSignal,
): Promise<StorePreview> {
  let target: ReturnType<typeof parseStoreUrl>;
  try {
    target = parseStoreUrl(rawUrl.trim());
  } catch {
    throw new HttpError(
      "VALIDATION",
      "Usá una página de un juego de Steam o Nintendo compatible.",
      400,
    );
  }
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, AbortSignal.timeout(12000)])
    : AbortSignal.timeout(12000);
  try {
    let fields: StorePreview["fields"], quote: StorePreview["quote"];
    if (target.store === "steam") {
      const body = await fetchText(
        "https://store.steampowered.com/api/appdetails?appids=" +
          target.product +
          "&cc=" +
          target.region.toLowerCase() +
          "&l=english",
        signal,
      );
      const result = object(JSON.parse(body))[target.product];
      quote = parseSteam(result);
      const data = object(object(result).data),
        platforms = object(data.platforms);
      fields = {
        title: quote.name ?? "",
        ...(Object.values(platforms).some((value) => value === true)
          ? { platforms: "PC" }
          : {}),
        ...releaseFields(quote.release),
      };
    } else {
      const html = await fetchText(target.url, signal);
      fields = nintendoMetadata(html, target.url);
      try {
        quote = parseNintendo(html, target.url);
      } catch {
        quote = {
          status: "unavailable",
          price: null,
          regular: null,
          currency: null,
          discount: 0,
        };
      }
    }
    return storePreviewSchema.parse({
      url: target.url,
      store: target.store,
      region: target.region,
      fields,
      quote,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    throw new HttpError(
      "TEMPORARY",
      "No se pudieron traer los datos de la tienda. Reintentá o completá el juego manualmente.",
      503,
    );
  }
}
