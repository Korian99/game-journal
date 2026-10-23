import { load } from "cheerio";
import { normalizeConsoleLabels } from "./journal/console-labels";
import { emptyRecord, type JournalRecord, type Price } from "./types";
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
export function shouldNotify(
  old: {
    price: number | null;
    currency: string | null;
    discount: number;
  } | null,
  next: { price: number | null; currency: string | null; discount: number },
  target?: number | null,
) {
  if (
    !old ||
    old.price === null ||
    next.price === null ||
    !old.currency ||
    old.currency !== next.currency
  )
    return false;
  const changed =
    next.price < old.price || (old.discount === 0 && next.discount > 0);
  return changed && (target == null || next.price <= target);
}
export function mergeField(base: unknown, current: unknown, incoming: unknown) {
  const eq = (a: unknown, b: unknown) =>
    JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (eq(current, incoming) || eq(incoming, base))
    return { value: current, conflict: false };
  if (eq(current, base)) return { value: incoming, conflict: false };
  return { value: current, conflict: true };
}
const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const num = (v: unknown) =>
  v !== "" && v != null && Number.isFinite(Number(v)) ? Number(v) : null;
function date(v: unknown) {
  if (typeof v === "number" && v > 10000)
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000)
      .toISOString()
      .slice(0, 10);
  return String(v ?? "");
}
function cleanTitle(v: unknown) {
  return String(v ?? "")
    .replace(/\s*\[Updated:.*?\]\*?$/i, "")
    .trim();
}
export type WorkbookTab = { name: string; values: unknown[][] };
export type ImportRecord = JournalRecord & {
  links?: string[];
  raw?: Record<string, unknown>;
};
export function parseWorkbook(tabs: WorkbookTab[]): ImportRecord[] {
  const result: ImportRecord[] = [];
  for (const tab of tabs) {
    if (
      !["Tablas", "2025", "2026", "<2025"].includes(tab.name) ||
      !tab.values.length
    )
      continue;
    const headers = tab.values[0].map(norm);
    const counts = new Map<string, number>();
    for (const row of tab.values.slice(1)) {
      const get = (...names: string[]) => {
        const idx = headers.findIndex((h) => names.map(norm).includes(h));
        return idx < 0 ? "" : (row[idx] ?? "");
      };
      if (tab.name === "Tablas") {
        for (const mode of ["wishlist", "upcoming"] as const) {
          const start = headers.indexOf(
            norm(mode === "wishlist" ? "Nombre" : "Proximos"),
          );
          if (start < 0) continue;
          const urlHeaders = headers.flatMap((h, i) =>
            ["url", "link", "enlace"].includes(h) ? [i] : [],
          );
          // Some sheets put each URL before its title; keep both tables separate.
          const leadingLinks = urlHeaders.filter((i) => i < start);
          const precedingLink = leadingLinks.at(-1);
          const usesLeadingLinks =
            urlHeaders.length > 0 && urlHeaders[0] < headers.indexOf("nombre");
          const sectionStart = usesLeadingLinks
            ? mode === "wishlist"
              ? 0
              : (precedingLink ?? start)
            : start;
          const next = headers.findIndex(
            (h, i) => i > start && ["nombre", "proximos"].includes(h),
          );
          const end =
            next < 0
              ? headers.length
              : usesLeadingLinks
                ? (urlHeaders.find((i) => i > start && i < next) ?? next)
                : next;
          const get = (...names: string[]) => {
            const index = headers.findIndex(
              (h, i) =>
                i >= sectionStart && i < end && names.map(norm).includes(h),
            );
            return index < 0 ? "" : (row[index] ?? "");
          };
          const title = cleanTitle(row[start]);
          const url = String(
            get("URL", "Link", "Enlace") ||
              row.slice(start + 1, end).find((value) => {
                try {
                  parseStoreUrl(String(value));
                  return true;
                } catch {
                  return false;
                }
              }) ||
              "",
          );
          if (!title || !url) continue;
          try {
            parseStoreUrl(url);
          } catch {
            continue;
          }
          const key = "Tablas:" + mode + ":" + norm(title);
          result.push({
            ...emptyRecord,
            title,
            status: mode,
            ownership: String(get("Comprado")),
            priority:
              num(get("Prioridad")) ??
              (String(get("Prioridad")).trim() || null),
            hype: String(get("Hype")),
            estimated: String(get("Hs. Estimadas")),
            sourceKey: key,
            links: [parseStoreUrl(url).url],
            raw: Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
          });
        }
        continue;
      }
      const title = cleanTitle(get("Juego"));
      if (!title) continue;
      const base = tab.name + ":" + norm(title);
      const occurrence = counts.get(base) ?? 0;
      counts.set(base, occurrence + 1);
      const finish = get("Termine?", "Termine");
      const state = norm(finish);
      const status =
        state === "si" ||
        typeof finish === "number" ||
        /^\d{1,4}[/-]/.test(state)
          ? "completed"
          : state === "jugando"
            ? "playing"
            : tab.name === "<2025"
              ? "remembered"
              : state === "no"
                ? "abandoned"
                : "wishlist";
      result.push({
        ...emptyRecord,
        title,
        year: num(get("Salio en")),
        platforms: normalizeConsoleLabels(String(get("Consolas donde salio"))),
        device: normalizeConsoleLabels(String(get("Consola"))),
        period: tab.name === "<2025" ? String(get("Jugue en")) : tab.name,
        started: date(get("Empece")),
        finished:
          state === "si" || state === "no" || state === "jugando"
            ? ""
            : date(finish),
        status,
        ownership: "",
        hours: num(get("Hs. Jugadas")),
        estimated: String(get("Hs. Estimadas")),
        rating: num(get("Reseña")),
        memorability: num(get("Memorabilidad")),
        impression: String(get("Impresiones")),
        focus: String(get("Historia, Gameplay o Ambos")),
        replay: String(get("Rejugaria?")),
        reason: String(get("Por que?")),
        notes: String(get("Comentarios Adicionales")),
        sourceKey: base + (occurrence ? ":duplicate:" + occurrence : ""),
        raw: Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
      });
    }
  }
  return result;
}
export type ImportPlan = {
  incoming: ImportRecord;
  id?: string;
  expectedUpdatedAt?: string;
  kind: "add" | "update" | "conflict" | "unchanged";
  changes: Record<string, unknown>;
  conflicts: string[];
};
const fields = [
  "title",
  "year",
  "platforms",
  "device",
  "period",
  "started",
  "finished",
  "status",
  "ownership",
  "priority",
  "hype",
  "hours",
  "estimated",
  "rating",
  "memorability",
  "impression",
  "focus",
  "replay",
  "reason",
  "notes",
] as const;
export function makeImportPlan(
  incoming: ImportRecord[],
  existing: (Partial<JournalRecord> & {
    source_key?: string;
    source_snapshot?: Record<string, unknown>;
    deleted_at?: string | null;
  })[],
): ImportPlan[] {
  return incoming.map((row) => {
    const matches = existing.filter(
      (r) => (r.sourceKey ?? r.source_key) === row.sourceKey,
    );
    const old = matches[0];
    const changes: Record<string, unknown> = {};
    const conflicts: string[] = [];
    if (!old)
      return {
        incoming: row,
        kind: row.sourceKey.includes(":duplicate:") ? "conflict" : "add",
        changes: { ...row },
        conflicts: row.sourceKey.includes(":duplicate:") ? ["duplicate"] : [],
      };
    if (old.deleted_at)
      return {
        incoming: row,
        id: old.id,
        expectedUpdatedAt: old.updated_at,
        kind: "conflict",
        changes: {},
        conflicts: ["trash"],
      };
    const baseline = old.sourceSnapshot ?? old.source_snapshot ?? {};
    const newLinks = (row.links ?? []).filter(
      (link) =>
        !(Array.isArray(baseline.links) ? baseline.links : []).includes(link),
    );
    if (newLinks.length) changes.links = newLinks;
    for (const field of fields) {
      const normalize = (value: unknown) =>
        (field === "device" || field === "platforms") &&
        typeof value === "string"
          ? normalizeConsoleLabels(value)
          : value;
      const merged = mergeField(
        normalize(baseline[field]),
        normalize(old[field]),
        normalize(row[field]),
      );
      if (merged.conflict) conflicts.push(field);
      if (
        JSON.stringify(merged.value ?? null) !==
        JSON.stringify(old[field] ?? null)
      )
        changes[field] = merged.value;
    }
    return {
      incoming: row,
      id: old.id,
      expectedUpdatedAt: old.updated_at,
      kind: conflicts.length
        ? "conflict"
        : Object.keys(changes).length
          ? "update"
          : "unchanged",
      changes,
      conflicts,
    };
  });
}
