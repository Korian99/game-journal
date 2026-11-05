import { load } from "cheerio";
import type { Price } from "../../lib/types";
export function parseStoreUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw Error("Usá un enlace HTTPS de Steam o Nintendo.");
  if (u.hostname === "store.steampowered.com") {
    const id = /^\/app\/(\d+)(?:\/|$)/.exec(u.pathname)?.[1];
    if (!id) throw Error("Enlace Steam inválido");
    const region = (u.searchParams.get("cc") ?? "AR").toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) throw Error("Región de Steam inválida");
    return {
      store: "steam",
      product: id,
      region,
      key: "steam:" + id + ":" + region,
      url:
        "https://store.steampowered.com/app/" +
        id +
        "/" +
        (region === "AR" ? "" : "?cc=" + region),
    };
  }
  if (["www.nintendo.com", "nintendo.com"].includes(u.hostname)) {
    const match =
      /^\/(us|en-us|es-ar|en-ca|en-gb|es-es|es-mx|pt-br)\/store\/products\/([a-zA-Z0-9-]+)\/?$/.exec(
        u.pathname,
      );
    if (!match)
      throw Error("La región o el producto Nintendo no son compatibles.");
    const region = (
      {
        us: "US",
        "en-us": "US",
        "es-ar": "AR",
        "en-ca": "CA",
        "en-gb": "GB",
        "es-es": "ES",
        "es-mx": "MX",
        "pt-br": "BR",
      } as Record<string, string>
    )[match[1]];
    return {
      store: "nintendo",
      product: match[2],
      region,
      key: "nintendo:" + match[2] + ":" + region,
      url:
        "https://www.nintendo.com/" +
        match[1] +
        "/store/products/" +
        match[2] +
        "/",
    };
  }
  throw Error("Tienda no compatible");
}
function storeTitle(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const title = value.replace(/\s+/g, " ").trim();
  return title.length > 0 && title.length <= 300 ? title : undefined;
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function parseSteam(response: unknown): Price {
  const result = object(response),
    d = object(result.data);
  if (!result.success || !result.data)
    return {
      status: "unavailable",
      price: null,
      regular: null,
      currency: null,
      discount: 0,
    };
  const p = object(d.price_overview),
    release = object(d.release_date);
  const early =
    Array.isArray(d.genres) &&
    d.genres.some((genre) => String(object(genre).id) === "70");
  return {
    name: storeTitle(d.name),
    status: release.coming_soon
      ? "upcoming"
      : early
        ? "early_access"
        : d.is_free
          ? "free"
          : d.price_overview
            ? "available"
            : "unavailable",
    price: d.is_free
      ? 0
      : typeof p.final === "number" && Number.isFinite(p.final)
        ? p.final / 100
        : null,
    regular: d.is_free
      ? 0
      : typeof p.initial === "number" && Number.isFinite(p.initial)
        ? p.initial / 100
        : null,
    currency: typeof p.currency === "string" ? p.currency : null,
    discount: typeof p.discount_percent === "number" ? p.discount_percent : 0,
    release: typeof release.date === "string" ? release.date : undefined,
  };
}
export function parseNintendo(html: string, url: string): Price {
  const target = parseStoreUrl(url);
  const $ = load(html);
  const nodes: Record<string, unknown>[] = [];
  const quotes: Record<string, unknown>[] = [];
  let verifiedName: string | undefined;
  function structured(v: unknown) {
    if (Array.isArray(v)) {
      v.forEach(structured);
      return;
    }
    if (v && typeof v === "object") {
      const node = object(v);
      nodes.push(node);
      if (node["@graph"]) structured(node["@graph"]);
    }
  }
  function cached(input: unknown, depth = 0) {
    if (depth > 40) return;
    const v = object(input);
    if (typeof input === "string" && input.trim().startsWith("{")) {
      try {
        cached(JSON.parse(input), depth + 1);
      } catch {}
      return;
    }
    if (!v || typeof v !== "object") return;
    if (
      v.urlKey === target.product &&
      (!v.locale ||
        String(v.locale)
          .toUpperCase()
          .replace("-", "_")
          .endsWith("_" + target.region))
    ) {
      for (const [key, value] of Object.entries(v))
        if (
          key.startsWith("prices(") &&
          key.includes('"personalized":false') &&
          value &&
          typeof value === "object"
        )
          quotes.push(object(value));
    }
    for (const child of Object.values(v)) cached(child, depth + 1);
  }
  $('script[type="application/ld+json"]').each((_, e) => {
    try {
      structured(JSON.parse($(e).text()));
    } catch {}
  });
  $('script[type="application/json"]').each((_, e) => {
    try {
      cached(JSON.parse($(e).text()));
    } catch {}
  });
  for (const n of nodes) {
    if (
      ![n["@type"]]
        .flat()
        .some((t) =>
          ["Product", "VideoGame", "SoftwareApplication"].includes(String(t)),
        )
    )
      continue;
    const offer = object(Array.isArray(n.offers) ? n.offers[0] : n.offers);
    const candidate = n.url ?? offer.url;
    if (candidate) {
      try {
        const identity = parseStoreUrl(new URL(String(candidate), url).href);
        if (
          identity.product !== target.product ||
          identity.region !== target.region
        )
          continue;
      } catch {
        continue;
      }
    }
    if (!candidate && nodes.filter((v) => v.offers && v.name).length !== 1)
      continue;
    const name = storeTitle(n.name);
    if (candidate && name) verifiedName = name;

    if (
      offer &&
      offer.price !== undefined &&
      Number.isFinite(Number(offer.price)) &&
      typeof offer.priceCurrency === "string"
    ) {
      const final = Number(offer.price);
      if (final < 0) continue;
      const currency = offer.priceCurrency.toUpperCase();
      const quote = quotes.find(
        (q) =>
          q.currency === currency &&
          Number(q.finalPrice) === final &&
          Number.isFinite(Number(q.regularPrice)) &&
          Number(q.regularPrice) >= final,
      );
      const regular = quote ? Number(quote.regularPrice) : final;
      return {
        name,
        status: final === 0 ? "free" : "available",
        price: final,
        regular,
        currency,
        discount:
          regular > final && regular > 0
            ? Math.round((1 - final / regular) * 100)
            : 0,
      };
    }
  }
  if (verifiedName)
    return {
      name: verifiedName,
      status: "unavailable",
      price: null,
      regular: null,
      currency: null,
      discount: 0,
    };
  throw Error(
    "Nintendo no devolvió un precio verificable; se conserva el último.",
  );
}
