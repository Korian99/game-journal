import { describe, expect, it } from "vitest";
import { statusAfterDateEdits } from "../src/lib/journal/entry-status";
import { emptyRecord } from "../src/lib/types";

describe("status when saving play dates", () => {
  it("starts a wishlist game when a start date is entered", () => {
    const original = { ...emptyRecord, status: "wishlist" as const };
    expect(
      statusAfterDateEdits({ ...original, started: "20/10/2026" }, original),
    ).toBe("playing");
  });
  it("completes a playing game when a finish date is entered", () => {
    const original = {
      ...emptyRecord,
      status: "playing" as const,
      started: "2026-10-01",
    };
    expect(
      statusAfterDateEdits({ ...original, finished: "20/10/2026" }, original),
    ).toBe("completed");
  });
  it("gives the finish date priority when both dates are entered together", () => {
    expect(
      statusAfterDateEdits({
        ...emptyRecord,
        started: "2026-10-01",
        finished: "2026-10-20",
      }),
    ).toBe("completed");
  });
  it("allows a finish date without a known start date", () => {
    expect(
      statusAfterDateEdits({ ...emptyRecord, finished: "20/10/2026" }),
    ).toBe("completed");
  });
  it.each(["paused", "abandoned"] as const)(
    "preserves %s when dates are unchanged",
    (status) => {
      const original = { ...emptyRecord, status, started: "2026-10-01" };
      const draft = { ...original, notes: "Updated review" };
      expect(statusAfterDateEdits(draft, original)).toBe(status);
    },
  );
  it("compares calendar dates rather than their display format", () => {
    const original = {
      ...emptyRecord,
      status: "paused" as const,
      started: "2026-10-01",
    };
    expect(
      statusAfterDateEdits({ ...original, started: "01/10/2026" }, original),
    ).toBe("paused");
  });
  it("resumes a game when its start date is changed", () => {
    const original = {
      ...emptyRecord,
      status: "paused" as const,
      started: "2026-10-01",
    };
    expect(
      statusAfterDateEdits({ ...original, started: "20/10/2026" }, original),
    ).toBe("playing");
  });
  it("keeps a finished game completed when correcting its start date", () => {
    const original = {
      ...emptyRecord,
      status: "completed" as const,
      started: "2026-10-01",
      finished: "2026-10-20",
    };
    expect(
      statusAfterDateEdits({ ...original, started: "02/10/2026" }, original),
    ).toBe("completed");
  });
  it("does not invent a state when dates are cleared", () => {
    const original = {
      ...emptyRecord,
      status: "completed" as const,
      started: "2026-10-01",
      finished: "2026-10-20",
    };
    expect(
      statusAfterDateEdits(
        { ...original, started: "", finished: "" },
        original,
      ),
    ).toBe("completed");
  });
  it.each(["No", "31/02/2026", "20/10", ""])(
    "does not treat %j as a date",
    (value) => {
      expect(
        statusAfterDateEdits({
          ...emptyRecord,
          started: value,
          finished: value,
        }),
      ).toBe("wishlist");
    },
  );
});

describe("status defaults for new games", () => {
  it("uses only known future releases and an explicit upcoming quote", async () => {
    const { defaultNewEntryStatus } =
      await import("../src/lib/journal/entry-status");
    expect(defaultNewEntryStatus).toBeTypeOf("function");

    const now = new Date("2026-06-30T23:00:00-03:00");
    const status = (release: string, upcomingQuote = false) =>
      defaultNewEntryStatus(
        { ...emptyRecord, release, year: Number(release.slice(0, 4)) || null },
        now,
        upcomingQuote,
      );

    expect(status("2026-07-01")).toBe("upcoming");
    expect(status("2026-06-30")).toBe("wishlist");
    expect(status("2026-01-01")).toBe("wishlist");
    expect(status("2027")).toBe("upcoming");
    expect(status("2026")).toBe("wishlist");
    expect(status("2027-spring")).toBe("upcoming");
    expect(status("2026-summer")).toBe("wishlist");
    expect(status("unknown")).toBe("wishlist");
    expect(status("unknown", true)).toBe("upcoming");
    expect(status("2026-06-30", true)).toBe("wishlist");
    expect(
      defaultNewEntryStatus(
        {
          ...emptyRecord,
          id: "existing",
          status: "paused",
          release: "2027-01-01",
        },
        now,
      ),
    ).toBe("paused");
  });
});
