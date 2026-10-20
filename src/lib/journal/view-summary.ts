import type { JournalRecord } from "../types";
import { dateOrder } from "./view-config";

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
  for (const record of records) {
    const devices = record.device
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
  }
  return {
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
