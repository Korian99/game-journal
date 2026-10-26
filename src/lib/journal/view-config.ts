import type { JournalRecord, Status } from "../types";

export const viewStatuses: Record<string, Status[]> = {
  library: ["playing", "completed", "paused", "abandoned"],
  journal: ["remembered", "playing", "completed", "abandoned", "paused"],
  wishlist: ["wishlist"],
  upcoming: ["upcoming"],
};

export function defaultViewSort(view: string) {
  const primary =
    view === "library"
      ? { id: "started", desc: true }
      : view === "journal"
        ? { id: "period", desc: true }
        : view === "upcoming"
          ? { id: "year", desc: false }
          : view === "wishlist"
            ? { id: "priority", desc: false }
            : null;
  return [...(primary ? [primary] : []), { id: "title", desc: false }];
}

export function dateOrder(value: string): number | undefined {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/.exec(text);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  if (!iso && !local) return undefined;
  const rawYear = iso ? iso[1] : local![3];
  const shortYear = Number(rawYear);
  // A fixed century window keeps historical dates stable across calendar years.
  const year =
    !iso && rawYear.length === 2
      ? (shortYear < 50 ? 2000 : 1900) + shortYear
      : shortYear;
  const month = Number(iso ? iso[2] : local![2]);
  const day = Number(iso ? iso[3] : local![1]);
  const stamp = Date.UTC(year, month - 1, day);
  const date = new Date(stamp);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? stamp
    : undefined;
}

export function formatDate(value: string): string {
  const text = value.trim();
  const stamp = dateOrder(text);
  if (stamp === undefined) return text;
  const date = new Date(stamp);
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCFullYear()).padStart(4, "0"),
  ].join("/");
}

const argentinaTimestamp = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const parts = argentinaTimestamp.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return (
    [part("day"), part("month"), part("year")].join("/") +
    ", " +
    part("hour") +
    ":" +
    part("minute")
  );
}

export function periodOrder(value: string): number | undefined {
  const year = /\b(\d{4})\b/.exec(value);
  return year ? Number(year[1]) : undefined;
}

/** TanStack comparator: dates follow the period direction; missing values stay last and names stay A–Z. */
export function compareJournalPeriods(
  a: Pick<JournalRecord, "period" | "started" | "finished" | "title">,
  b: Pick<JournalRecord, "period" | "started" | "finished" | "title">,
  descending = false,
): number {
  const fixedDirection = descending ? -1 : 1;
  const fields = [
    [periodOrder(a.period), periodOrder(b.period)],
    [dateOrder(a.started), dateOrder(b.started)],
    [dateOrder(a.finished), dateOrder(b.finished)],
  ];
  for (const [first, second] of fields) {
    if (first === undefined && second === undefined) continue;
    // Compensate for TanStack's descending inversion to keep missing values last.
    if (first === undefined) return fixedDirection;
    if (second === undefined) return -fixedDirection;
    if (first !== second) return first - second;
  }
  return (
    a.title.localeCompare(b.title, "es", {
      sensitivity: "base",
      numeric: true,
    }) * fixedDirection
  );
}

type DatedRecord = Pick<JournalRecord, "started" | "finished" | "period">;

export function currentYear(now = new Date()): string {
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    timeZone: "America/Buenos_Aires",
  }).format(now);
}

export function matchesViewYear(
  record: DatedRecord,
  view: string,
  year: string,
): boolean {
  if (!["library", "journal"].includes(view) || !year) return true;
  const target = Number(year);
  if (view === "library") {
    const finished = dateOrder(record.finished);
    const date = finished ?? dateOrder(record.started);
    if (date !== undefined) return new Date(date).getUTCFullYear() === target;
  }
  const years = [...record.period.matchAll(/\b(\d{4})\b/g)].map((match) =>
    Number(match[1]),
  );
  return (
    years.length > 0 &&
    target >= Math.min(...years) &&
    target <= Math.max(...years)
  );
}

export function viewYears(
  records: DatedRecord[],
  view: string,
  present = currentYear(),
): string[] {
  const years = [Number(present)];
  for (const record of records) {
    if (
      view === "journal" ||
      [record.started, record.finished].every(
        (value) => dateOrder(value) === undefined,
      )
    ) {
      for (const match of record.period.matchAll(/\b(\d{4})\b/g))
        years.push(Number(match[1]));
    } else {
      for (const value of [record.started, record.finished]) {
        const date = dateOrder(value);
        if (date !== undefined) years.push(new Date(date).getUTCFullYear());
      }
    }
  }
  const first = Math.min(...years),
    last = Math.max(...years);
  return Array.from({ length: last - first + 1 }, (_, index) =>
    String(last - index),
  );
}

export function reviewOrder(
  record: Pick<JournalRecord, "rating" | "memorability">,
): number | undefined {
  return (
    record.rating ??
    (record.memorability == null ? undefined : record.memorability * 10)
  );
}

/** Diario uses numeric impressions out of ten when no review was recorded. */
export function journalReviewOrder(
  record: Pick<JournalRecord, "rating" | "impression">,
): number | undefined {
  if (record.rating != null) return record.rating;
  const text = record.impression.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return undefined;
  const impression = Number(text.replace(",", "."));
  return impression >= 0 && impression <= 10 ? impression * 10 : undefined;
}
