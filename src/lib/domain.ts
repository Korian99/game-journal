import { normalizeConsoleLabels } from "./journal/console-labels";
import { emptyRecord, type JournalRecord } from "./types";
import { parseCoverImageUrl, type Cover } from "./covers";
import { parseStoreUrl } from "@/features/stores/price-parser";
export { parseStoreUrl, parseSteam, parseNintendo } from "@/features/stores/price-parser";
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
  const sheetCover = (value: unknown): Cover | undefined => {
    const providerUrl = parseCoverImageUrl(value);
    return providerUrl ? { providerUrl } : undefined;
  };
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
          const coverHeader = norm(
            mode === "wishlist"
              ? "Cover Art URL (Nombre)"
              : "Cover Art URL (Próximos)",
          );
          const coverIndex = headers.indexOf(coverHeader);
          const cover = sheetCover(coverIndex < 0 ? "" : row[coverIndex]);
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
            ...(cover ? { cover } : {}),
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
      const cover = sheetCover(get("Cover Art URL"));
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
        ...(cover ? { cover } : {}),
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
    gameId?: string;
    source_key?: string;
    source_snapshot?: Record<string, unknown>;
    deleted_at?: string | null;
  })[],
): ImportPlan[] {
  const coverUrlsByGame = new Map<string, Set<string>>();
  for (const row of incoming) {
    if (!row.cover?.providerUrl) continue;
    const match = existing.find(
      (entry) => (entry.sourceKey ?? entry.source_key) === row.sourceKey,
    );
    if (!match?.gameId) continue;
    const urls = coverUrlsByGame.get(match.gameId) ?? new Set<string>();
    urls.add(row.cover.providerUrl);
    coverUrlsByGame.set(match.gameId, urls);
  }
  const plans: ImportPlan[] = incoming.map((row) => {
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
    const coverUrl = (value: unknown) =>
      value && typeof value === "object" && "providerUrl" in value
        ? (value as { providerUrl?: unknown }).providerUrl
        : undefined;
    const incomingCoverUrl = row.cover?.providerUrl;
    if (incomingCoverUrl) {
      const currentCover =
        old.cover && typeof old.cover === "object"
          ? (old.cover as Cover)
          : undefined;
      const mergedCoverUrl = mergeField(
        coverUrl(baseline.cover),
        coverUrl(currentCover),
        incomingCoverUrl,
      );
      const ambiguousGameArtwork =
        !!old.gameId && (coverUrlsByGame.get(old.gameId)?.size ?? 0) > 1;
      if (mergedCoverUrl.conflict || ambiguousGameArtwork)
        conflicts.push("cover");
      else if (
        typeof mergedCoverUrl.value === "string" &&
        mergedCoverUrl.value !== coverUrl(currentCover)
      ) {
        changes.cover = {
          ...(currentCover?.overrideUrl
            ? { overrideUrl: currentCover.overrideUrl }
            : {}),
          providerUrl: mergedCoverUrl.value,
        };
      }
    }
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
  const plannedArtworkByGame = new Map<string, string>();
  for (const plan of plans) {
    const changedCover = plan.changes.cover as Cover | undefined;
    if (plan.conflicts.includes("cover") || !changedCover?.providerUrl) continue;
    const match = existing.find(
      (entry) =>
        (entry.sourceKey ?? entry.source_key) === plan.incoming.sourceKey,
    );
    if (!match?.gameId) continue;
    const url = changedCover.providerUrl;
    const alreadyPlanned = plannedArtworkByGame.get(match.gameId);
    if (alreadyPlanned === url) {
      delete plan.changes.cover;
      if (!plan.conflicts.length && !Object.keys(plan.changes).length)
        plan.kind = "unchanged";
    } else {
      plannedArtworkByGame.set(match.gameId, url);
    }
  }
  return plans;
}
