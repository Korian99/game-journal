import type { JournalRecord } from "./types";

export const releaseSeasons = [
  { value: "spring", label: "Primavera" },
  { value: "summer", label: "Verano" },
  { value: "autumn", label: "Otoño" },
  { value: "winter", label: "Invierno" },
] as const;
export type ReleaseInfo =
  | { kind: "date"; year: number; value: string }
  | { kind: "season"; year: number; value: string; season: string }
  | { kind: "year"; year: number; value: string }
  | { kind: "unknown" };
type ReleasedRecord = Pick<
  JournalRecord,
  "year" | "release" | "sourceSnapshot"
>;

export function parseRelease(value: string): ReleaseInfo {
  const text = value.trim();
  const match =
    /^(\d{4})(?:-(\d{2})-(\d{2})|-(spring|summer|autumn|winter))?$/.exec(text);
  if (!match) return { kind: "unknown" };
  const year = Number(match[1]);
  if (year < 1950 || year > 2200) return { kind: "unknown" };
  if (match[4]) return { kind: "season", year, value: text, season: match[4] };
  if (!match[2]) return { kind: "year", year, value: text };
  const month = Number(match[2]),
    day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { kind: "date", year, value: text }
    : { kind: "unknown" };
}
export function recordRelease(record: ReleasedRecord): ReleaseInfo {
  if (typeof record.release === "string") return parseRelease(record.release);
  const raw = record.sourceSnapshot?.raw;
  if (
    raw &&
    typeof raw === "object" &&
    "cells" in raw &&
    Array.isArray(raw.cells)
  ) {
    const cell = raw.cells.find(
      (cell: unknown) =>
        cell &&
        typeof cell === "object" &&
        "header" in cell &&
        String(cell.header).trim().toLowerCase() === "fecha de salida",
    );
    const value: unknown = cell?.value;
    let imported = "";
    if (typeof value === "number" && Number.isInteger(value)) {
      if (value >= 1950 && value <= 2200) imported = String(value);
      else if (value >= 18264 && value <= 109939)
        imported = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
          .toISOString()
          .slice(0, 10);
    } else if (typeof value === "string") {
      const text = value.trim();
      const period =
        /^en (\d{4})(?: \((primavera|verano|otoño|invierno)\))?$/i.exec(text);
      const seasons: Record<string, string> = {
        primavera: "spring",
        verano: "summer",
        otoño: "autumn",
        invierno: "winter",
      };
      imported = period
        ? period[1] + (period[2] ? "-" + seasons[period[2].toLowerCase()] : "")
        : text;
    }
    const release = parseRelease(imported);
    if (release.kind !== "unknown") return release;
  }
  return parseRelease(String(record.year ?? ""));
}
export function releaseOrder(record: ReleasedRecord): number | undefined {
  const release = recordRelease(record);
  // Separate precision groups so every exact date precedes every season/year.
  if (release.kind === "date") return Number(release.value.replaceAll("-", ""));
  if (release.kind === "season")
    return (
      100_000_000 +
      release.year * 10 +
      releaseSeasons.findIndex((s) => s.value === release.season)
    );
  if (release.kind === "year") return 200_000_000 + release.year;
  return undefined;
}
export function releaseLabel(record: ReleasedRecord): string {
  const release = recordRelease(record);
  if (release.kind === "date") {
    const [year, month, day] = release.value.split("-");
    return [day, month, year].join("/");
  }
  if (release.kind === "season")
    return (
      releaseSeasons.find((s) => s.value === release.season)!.label +
      " " +
      release.year
    );
  return release.kind === "year" ? String(release.year) : "Sin fecha";
}

export function compareReleases(
  a: ReleasedRecord,
  b: ReleasedRecord,
  descending = false,
): number {
  const first = releaseOrder(a),
    second = releaseOrder(b);
  const group = (order: number | undefined) =>
    order === undefined ? 3 : Math.floor(order / 100_000_000);
  const difference = group(first) - group(second);
  // TanStack reverses the result for descending sorts; keep precision groups fixed.
  return difference
    ? difference * (descending ? -1 : 1)
    : (first ?? 0) - (second ?? 0);
}

const argentinaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function releaseHasArrived(
  record: ReleasedRecord,
  now = new Date(),
): boolean {
  const release = recordRelease(record);
  if (release.kind !== "date") return false;
  const parts = argentinaDay.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const today = [part("year"), part("month"), part("day")].join("-");
  return release.value <= today;
}
