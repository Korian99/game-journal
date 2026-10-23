import type { JournalRecord } from "../types";
import { dateOrder, journalReviewOrder } from "./view-config";
import { normalizeConsoleLabels } from "./console-labels";

export const minimumConsoleGames = 5;

export function summarizeGames(records: JournalRecord[], year = "") {
  const dateMatches = (value: string) => {
    const date = dateOrder(value);
    return (
      date !== undefined &&
      (!year || new Date(date).getUTCFullYear() === Number(year))
    );
  };
  const hours = records.flatMap((record) =>
    typeof record.hours === "number" && Number.isFinite(record.hours)
      ? [record.hours]
      : [],
  );
  const ratings = records.flatMap((record) =>
    typeof record.rating === "number" && Number.isFinite(record.rating)
      ? [record.rating]
      : [],
  );
  const consoles = new Map<string, { name: string; count: number }>();
  const consoleRatings = new Map<
    string,
    { name: string; total: number; count: number; playedCount: number }
  >();
  for (const record of records) {
    const devices = normalizeConsoleLabels(record.device)
      .split(";")
      .map((name) => name.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    for (const name of devices.length ? devices : ["Sin consola registrada"]) {
      const key = name.toLocaleLowerCase("es-AR");
      if (seen.has(key)) continue;
      seen.add(key);
      const current = consoles.get(key);
      if (current) current.count++;
      else consoles.set(key, { name, count: 1 });
    }
    // A score cannot be attributed to one console when several devices are listed.
    if (devices.length === 0 || seen.size !== 1) continue;
    const name = devices[0],
      key = name.toLocaleLowerCase("es-AR");
    const current = consoleRatings.get(key) ?? {
      name: consoles.get(key)?.name ?? name,
      total: 0,
      count: 0,
      playedCount: 0,
    };
    current.playedCount++;
    const score = journalReviewOrder(record);
    if (
      typeof score === "number" &&
      Number.isFinite(score) &&
      score >= 0 &&
      score <= 100
    ) {
      current.total += score;
      current.count++;
    }
    consoleRatings.set(key, current);
  }
  const bestRatedConsole =
    [...consoleRatings.values()]
      .filter(
        (console) =>
          console.playedCount >= minimumConsoleGames && console.count > 0,
      )
      .map(({ name, total, count, playedCount }) => ({
        name,
        averageScore: total / count,
        ratingCount: count,
        playedCount,
      }))
      .sort(
        (a, b) =>
          b.averageScore - a.averageScore ||
          b.ratingCount - a.ratingCount ||
          a.name.localeCompare(b.name, "es"),
      )[0] ?? null;
  return {
    bestRatedConsole,
    total: records.length,
    started: records.filter((record) => dateMatches(record.started)).length,
    finished: records.filter((record) => dateMatches(record.finished)).length,
    playing: records.filter((record) => record.status === "playing").length,
    hours: hours.reduce((sum, value) => sum + value, 0),
    hoursCount: hours.length,
    averageRating: ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : null,
    ratingCount: ratings.length,
    consoles: [...consoles.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"),
    ),
  };
}
