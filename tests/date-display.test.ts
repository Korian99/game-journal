import { expect, it } from "vitest";
import {
  formatDate as format,
  formatDateTime as timestamp,
} from "../src/lib/journal/view-config";
it("pads ISO calendar dates without shifting the day", () => {
  expect(format("2026-02-01")).toBe("01/02/2026");
  expect(format("2024-02-29")).toBe("29/02/2024");
});
it("normalizes existing day/month dates", () => {
  expect(format("1/2/2026")).toBe("01/02/2026");
  expect(format("9-10-2025")).toBe("09/10/2025");
});
it("preserves missing dates and historical text", () => {
  expect(format("")).toBe("");
  expect(format("No recuerdo")).toBe("No recuerdo");
  expect(format("31/02/2026")).toBe("31/02/2026");
});
it("shows padded dates with Argentina time for timestamps", () => {
  expect(timestamp("2026-10-02T01:05:00Z")).toBe("01/10/2026, 22:05");
  expect(timestamp("2026-02-03T15:07:00Z")).toBe("03/02/2026, 12:07");
});
it("handles missing or invalid timestamps", () => {
  expect(timestamp("")).toBe("—");
  expect(timestamp("invalid")).toBe("—");
});
