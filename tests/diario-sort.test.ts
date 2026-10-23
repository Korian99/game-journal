import { expect, it } from "vitest";
import { compareJournalPeriods } from "../src/lib/journal/view-config";
const base = { title: "Same game", period: "2025", started: "", finished: "" };
for (const desc of [false, true]) {
  const compare = (a: typeof base, b: typeof base) =>
    compareJournalPeriods(a, b, desc) * (desc ? -1 : 1);
  it(
    (desc ? "descending" : "ascending") +
      " keeps missing fields last and reaches later tie-breakers",
    () => {
      expect(compare({ ...base, started: "2025-01-01" }, base)).toBeLessThan(0);
      expect(compare({ ...base, finished: "2025-01-01" }, base)).toBeLessThan(
        0,
      );
      expect(
        compare({ ...base, title: "Alpha" }, { ...base, title: "Zulu" }),
      ).toBeLessThan(0);
      expect(
        compare(
          { ...base, period: "", title: "Alpha" },
          { ...base, period: "", title: "Zulu" },
        ),
      ).toBeLessThan(0);
      expect(compare(base, { ...base, period: "?" })).toBeLessThan(0);
      expect(compare(base, base)).toBe(0);
    },
  );
  it(
    (desc ? "descending" : "ascending") +
      " sorts parsed dates and periods in the selected direction",
    () => {
      const sign = desc ? -1 : 1;
      expect(
        compare({ ...base, period: "2024 - 2026" }, base) * sign,
      ).toBeLessThan(0);
      expect(
        compare(
          { ...base, started: "31/01/2025" },
          { ...base, started: "01/02/2025" },
        ) * sign,
      ).toBeLessThan(0);
      expect(
        compare(
          { ...base, started: "01/01/2025", finished: "2025-03-01" },
          { ...base, started: "2025-01-01", finished: "02/03/2025" },
        ) * sign,
      ).toBeLessThan(0);
    },
  );
}
