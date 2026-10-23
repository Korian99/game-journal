import { expect, it } from "vitest";
import { periodAfterDateEdits } from "../src/lib/journal/entry-period";
const original = { started: "", finished: "", period: "2014 - 2018" };
it("uses the start year when assigned, replacing an older approximate period", () => {
  expect(
    periodAfterDateEdits({ ...original, started: "20/10/2025" }, original),
  ).toBe("2025");
});
it("uses one year for matching dates and a range across years", () => {
  expect(
    periodAfterDateEdits(
      { ...original, started: "2025-01-01", finished: "31/12/2025" },
      original,
    ),
  ).toBe("2025");
  expect(
    periodAfterDateEdits(
      { ...original, started: "2025-12-31", finished: "01/01/2026" },
      original,
    ),
  ).toBe("2025-2026");
});
it("uses a known finish year without inventing a start date", () => {
  expect(
    periodAfterDateEdits({ ...original, finished: "2026-01-01" }, original),
  ).toBe("2026");
});
it("backfills a blank period from existing dates", () => {
  const saved = { started: "19/10/2026", finished: "", period: "   " };
  expect(periodAfterDateEdits(saved, saved)).toBe("2026");
});
it("preserves manually entered periods when dates have not changed", () => {
  const saved = { ...original, started: "2025-01-01" };
  expect(
    periodAfterDateEdits(
      { ...saved, period: "2024-2025", started: "01/01/2025" },
      saved,
    ),
  ).toBe("2024-2025");
  expect(periodAfterDateEdits(original, original)).toBe(original.period);
});
it("recalculates from the remaining date after removing a finish date", () => {
  const saved = {
    started: "2025-01-01",
    finished: "2026-01-01",
    period: "2025-2026",
  };
  expect(periodAfterDateEdits({ ...saved, finished: "" }, saved)).toBe("2025");
});
it("does not derive years from incomplete or invalid dates", () => {
  expect(
    periodAfterDateEdits(
      { ...original, started: "2026", finished: "31/02/2026" },
      original,
    ),
  ).toBe(original.period);
  expect(periodAfterDateEdits({ ...original, period: "" })).toBe("");
});
