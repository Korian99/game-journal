import type { JournalEntry } from "./journal-types";
import { dateOrder } from "./view-config";

export type RecapPeriod =
  | { type: "month"; year: number; month: number }
  | { type: "year"; year: number };

export type RecapDateExclusions = {
  missing: number;
  partial: number;
  approximate: number;
  invalid: number;
};

export type Recap = {
  period: RecapPeriod;
  finishedPlaythroughs: number;
  uniqueGamesFinished: number;
  /** Dates recorded in this period; this does not establish that activity occurred. */
  recordedStarts: number;
  /** Completed entries that lack a full, valid finish date, regardless of selected period. */
  excludedCompletedWithoutFullFinishDate: number;
  excludedFinishDateReasons: RecapDateExclusions;
};

const argentinaPeriod = (now: Date): RecapPeriod => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const part = (type: "year" | "month") =>
    Number(parts.find((value) => value.type === type)!.value);
  return { type: "month", year: part("year"), month: part("month") };
};

function datePeriod(
  value: string,
): { year: number; month: number } | undefined {
  const text = value.trim();
  const timestamp =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i.exec(
      text,
    );
  if (timestamp) {
    const [, , , , hour, minute, second, zone] = timestamp;
    if (
      dateOrder(text.slice(0, 10)) === undefined ||
      Number(hour) > 23 ||
      Number(minute) > 59 ||
      Number(second) > 59
    )
      return undefined;
    if (zone.toUpperCase() !== "Z") {
      const [offsetHour, offsetMinute] = zone.slice(1).split(":").map(Number);
      if (offsetHour > 23 || offsetMinute > 59) return undefined;
    }
    const instant = new Date(text);
    if (!Number.isFinite(instant.getTime())) return undefined;
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "America/Buenos_Aires",
      year: "numeric",
      month: "numeric",
    }).formatToParts(instant);
    return {
      year: Number(parts.find((part) => part.type === "year")!.value),
      month: Number(parts.find((part) => part.type === "month")!.value),
    };
  }
  // A malformed timestamp must not fall through to dateOrder's permissive T suffix.
  if (text.includes("T") || text.includes("t")) return undefined;

  const date = dateOrder(text);
  if (date === undefined) return undefined;
  const calendarDate = new Date(date);
  return {
    year: calendarDate.getUTCFullYear(),
    month: calendarDate.getUTCMonth() + 1,
  };
}

function exclusionReason(value: string): keyof RecapDateExclusions {
  const text = value.trim();
  if (!text) return "missing";
  if (
    /^(?:~|≈|ca\.?\s|c\.?\s|circa\b|aprox(?:imadamente)?\b|aprox\.?\s)/i.test(
      text,
    )
  )
    return "approximate";
  if (/^\d{4}(?:[-/ ]\d{1,2})?$/.test(text)) return "partial";
  return "invalid";
}

/**
 * Calcula recapitulaciones con la colección completa y sin filtrar del propietario activo.
 * No pasar colecciones compartidas ni resultados de filtros de la lista.
 * Las filas eliminadas se omiten también como protección defensiva.
 */
export function calculateRecap(
  records: readonly JournalEntry[],
  options: { period?: RecapPeriod; now?: Date } = {},
): Recap {
  const period = options.period ?? argentinaPeriod(options.now ?? new Date());
  if (
    !Number.isInteger(period.year) ||
    period.year < 1 ||
    (period.type === "month" &&
      (!Number.isInteger(period.month) ||
        period.month < 1 ||
        period.month > 12))
  ) {
    throw new RangeError("El período de recap debe ser un mes o año válido.");
  }

  const matches = (date: { year: number; month: number } | undefined) =>
    date !== undefined &&
    date.year === period.year &&
    (period.type === "year" || date.month === period.month);

  const exclusions: RecapDateExclusions = {
    missing: 0,
    partial: 0,
    approximate: 0,
    invalid: 0,
  };
  const completedWithFinishDate: { record: JournalEntry; index: number }[] = [];
  let recordedStarts = 0;

  records.forEach((record, index) => {
    if ("deleted_at" in record && record.deleted_at) return;
    if (matches(datePeriod(record.started))) recordedStarts++;
    if (record.status !== "completed") return;

    const finish = datePeriod(record.finished);
    if (finish === undefined) {
      exclusions[exclusionReason(record.finished)]++;
    } else if (matches(finish)) {
      completedWithFinishDate.push({ record, index });
    }
  });

  const uniqueGames = new Set(
    completedWithFinishDate.map(({ record, index }) =>
      record.gameId
        ? "game:" + record.gameId
        : record.id
          ? "playthrough:" + record.id
          : "entry:" + index,
    ),
  );

  return {
    period: { ...period },
    finishedPlaythroughs: completedWithFinishDate.length,
    uniqueGamesFinished: uniqueGames.size,
    recordedStarts,
    excludedCompletedWithoutFullFinishDate: Object.values(exclusions).reduce(
      (sum, count) => sum + count,
      0,
    ),
    excludedFinishDateReasons: exclusions,
  };
}
