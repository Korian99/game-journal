import type { JournalEntry } from "./journal-types";
import { dateOrder, matchesViewYear, viewStatuses } from "./view-config";
export type EstimateTarget = "story" | "extras" | "completionist";
export const estimateTargets = {
  story: "Historia",
  extras: "Historia + extras",
  completionist: "Completista",
} as const;
export function estimateHours(
  text: string,
  target: EstimateTarget,
): number | null {
  const clean = text
    .trim()
    .replace(/\s*(?:h|hs|horas)\.?$/i, "")
    .trim();
  const number = "(\\d+(?:[.,]\\d+)?)";
  const single = new RegExp("^" + number + "$").exec(clean);
  if (single)
    return target === "story" ? Number(single[1].replace(",", ".")) : null;
  const triple = new RegExp(
    "^" + number + "\\s*[-–/;]\\s*" + number + "\\s*[-–/;]\\s*" + number + "$",
  ).exec(clean);
  if (!triple) return null;
  const values = triple
    .slice(1)
    .map((value) => Number(value.replace(",", ".")));
  if (
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    values[0] > values[1] ||
    values[1] > values[2]
  )
    return null;
  return values[["story", "extras", "completionist"].indexOf(target)];
}
export function statistics(
  records: JournalEntry[],
  options: { year: string; target: EstimateTarget; platform?: string },
) {
  const cohort = records.filter(
    (record) =>
      viewStatuses.library.includes(record.status) &&
      matchesViewYear(record, "library", options.year) &&
      (!options.platform ||
        (record.device + ";" + record.platforms)
          .split(";")
          .map((x) => x.trim())
          .includes(options.platform)),
  );
  const inYear = (text: string) => {
    const date = dateOrder(text);
    return (
      date !== undefined &&
      (!options.year ||
        String(new Date(date).getUTCFullYear()) === options.year)
    );
  };
  const hours = cohort.filter(
    (record) =>
      typeof record.hours === "number" && Number.isFinite(record.hours),
  );
  const ratings = cohort.flatMap((record) =>
    record.rating == null ? [] : [record.rating],
  );
  const estimates = cohort.flatMap((record) => {
    const value = estimateHours(record.estimated, options.target);
    return value === null ? [] : [value];
  });
  const consoles = new Map<
    string,
    { name: string; count: number; hours: number }
  >();
  for (const record of cohort) {
    const devices = [
      ...new Map(
        record.device
          .split(";")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => [x.toLocaleLowerCase("es"), x]),
      ).values(),
    ];
    const name =
        devices.length > 1
          ? "Varias consolas"
          : (devices[0] ?? "Sin consola registrada"),
      key = name.toLocaleLowerCase("es"),
      current = consoles.get(key) ?? { name, count: 0, hours: 0 };
    current.count++;
    current.hours += record.hours ?? 0;
    consoles.set(key, current);
  }
  const completed = cohort.filter(
    (record) => record.status === "completed",
  ).length;
  return {
    total: cohort.length,
    uniqueGames: new Set(
      cohort.map(
        (record) =>
          record.gameId ?? record.id ?? record.title.toLocaleLowerCase("es"),
      ),
    ).size,
    started: cohort.filter((record) => inYear(record.started)).length,
    finished: cohort.filter((record) => inYear(record.finished)).length,
    completed,
    completionRate: cohort.length ? (completed / cohort.length) * 100 : null,
    hours: hours.reduce((sum, record) => sum + record.hours!, 0),
    hoursCount: hours.length,
    averageRating: ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null,
    ratingCount: ratings.length,
    estimatedHours: estimates.reduce((a, b) => a + b, 0),
    estimateCount: estimates.length,
    estimateSkipped: cohort.length - estimates.length,
    consoles: [...consoles.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"),
    ),
  };
}
