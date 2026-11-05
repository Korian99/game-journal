import { expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import type { JournalEntry } from "../src/lib/journal/journal-types";
import {
  dataChecks,
  findingValues,
  dataCheckDefaults,
  dataCheckStateSchema,
} from "../src/features/settings/data-checks";
const entry = (patch: Partial<JournalEntry> = {}): JournalEntry => ({
  ...emptyRecord,
  id: "20000000-0000-4000-8000-000000000001",
  title: "Fixture",
  status: "completed",
  year: 2025,
  started: "01/01/2025",
  finished: "02/01/2025",
  device: "PC",
  rating: 0,
  hours: 0,
  ...patch,
});
it("derives malformed dates, date order and legacy bounds without changing data", () => {
  const rows = [entry({ started: "32/01/2025", rating: 101, hours: -1 })];
  const before = JSON.stringify(rows);
  expect(dataChecks(rows).map((f) => f.kind)).toEqual([
    "invalid-start",
    "rating-range",
    "hours-range",
  ]);
  expect(
    dataChecks([entry({ finished: "31/12/2024" })]).map((f) => f.kind),
  ).toContain("date-order");
  expect(dataChecks([entry({ hours: 100001 })]).map((f) => f.kind)).toContain(
    "hours-range",
  );
  expect(JSON.stringify(rows)).toBe(before);
});
it("leaves valid zero scores, approximate memories and legitimate store links alone", () => {
  expect(
    dataChecks([
      entry(),
      entry({
        status: "remembered",
        started: "Around 2010",
        finished: "",
        period: "2009-2011",
        pages: ["https://example.com/reference"],
      }),
    ]),
  ).toEqual([]);
});
it("separates optional reminders from inconsistencies and recognizes played states", () => {
  const findings = dataChecks([
    entry({ rating: null, device: "PC", hours: null }),
    entry({
      id: "other",
      status: "wishlist",
      rating: null,
      device: "",
      hours: null,
      started: "",
      finished: "",
      priority: 0,
      ownership: "No",
      estimated: "2",
    }),
  ]);
  expect(findings.map((f) => f.kind)).toEqual([
    "missing-review",
    "missing-hours",
  ]);
  expect(findings.every((f) => f.category === "reminder")).toBe(true);
  expect(
    dataChecks([
      entry({
        status: "paused",
        finished: "",
        rating: null,
        device: "",
        hours: null,
      }),
    ]).map((f) => f.kind),
  ).toEqual(["completion", "missing-hours"]);
  expect(dataCheckDefaults).toEqual({
    review: false,
    console: false,
    hours: false,
  });
});
it("classifies ambiguous status/date combinations as suggestions rather than errors", () => {
  const findings = dataChecks([entry({ status: "playing" })]);
  expect(findings.find((f) => f.kind === "status-dates")?.category).toBe(
    "suggestion",
  );
});
it("fingerprints only values relevant to the finding, not title, notes or revisions", () => {
  const original = entry({ rating: null });
  const finding = dataChecks([original]).find(
    (f) => f.kind === "missing-review",
  )!;
  if (finding.kind === "completion") throw new Error("Expected persisted finding");
  expect(
    findingValues(finding.kind, {
      ...original,
      title: "Renamed",
      notes: "Unrelated",
      updated_at: "new",
    }),
  ).toEqual(finding.values);
  expect(findingValues(finding.kind, { ...original, rating: 1 })).not.toEqual(
    finding.values,
  );
  expect(dataChecks([entry({ rating: 1 })]).map((f) => f.kind)).not.toContain(
    "missing-review",
  );
  const changed = dataChecks([entry({ started: "Still unknown" })]).find(
    (f) => f.kind === "invalid-start",
  )!;
  expect(changed.values).not.toEqual(
    dataChecks([entry({ started: "Unknown" })]).find(
      (f) => f.kind === "invalid-start",
    )!.values,
  );
});
it("validates owner-free preferences and finding identities at the response boundary", () => {
  expect(
    dataCheckStateSchema.parse({
      preferences: dataCheckDefaults,
      dismissals: [],
    }),
  ).toEqual({ preferences: dataCheckDefaults, dismissals: [] });
  expect(
    dataCheckStateSchema.safeParse({
      preferences: { ...dataCheckDefaults, review: "yes" },
      dismissals: [],
    }).success,
  ).toBe(false);
});

it("still reports impossible exact memory dates while allowing approximate historical text", () => {
  expect(
    dataChecks([entry({ status: "remembered", started: "32/01/2025" })]).map(
      (f) => f.kind,
    ),
  ).toContain("invalid-start");
});

it("groups required missing fields by active game status using release fallback rules", () => {
  const records = [
    entry({
      id: "upcoming",
      title: " ",
      status: "upcoming",
      year: null,
      release: "",
      hype: "",
    }),
    entry({
      id: "wishlist",
      title: "Wishlist",
      status: "wishlist",
      priority: null,
      ownership: "",
      estimated: "  ",
      sourceSnapshot: {
        raw: { cells: [{ header: "Fecha de Salida", value: "en 2024 (otoño)" }] },
      },
    }),
    entry({ id: "playing", title: "Playing", status: "playing", started: "", device: " " }),
    entry({ id: "paused", title: "Paused", status: "paused", started: "", device: "" }),
    entry({ id: "remembered", title: "Remembered", status: "remembered", period: " " }),
    entry({ id: "abandoned", title: " ", status: "abandoned" }),
  ];
  const findings = dataChecks(records).filter((finding) => finding.kind === "completion");
  expect(findings).toHaveLength(records.length);
  expect(findings.map((finding) => finding.category)).toEqual(
    records.map(() => "completion"),
  );
  expect(findings.find((finding) => finding.entry.id === "upcoming")?.message).toContain(
    "Nombre del juego, Lanzamiento, Hype",
  );
  expect(findings.find((finding) => finding.entry.id === "wishlist")?.message).toContain(
    "Prioridad, Acceso al juego, Horas estimadas",
  );
  expect(findings.find((finding) => finding.entry.id === "playing")?.message).toContain(
    "Empecé, Consola donde jugué",
  );
  expect(
    dataChecks([
      entry({ id: "completed", title: "Completed", status: "completed", started: "", device: "" }),
    ]).find((finding) => finding.kind === "completion")?.message,
  ).toContain("Empecé, Consola donde jugué");
  expect(findings.find((finding) => finding.entry.id === "paused")?.message).toContain(
    "Empecé, Consola donde jugué",
  );
  expect(findings.find((finding) => finding.entry.id === "remembered")?.message).toContain(
    "Período jugado",
  );
  expect(findings.find((finding) => finding.entry.id === "abandoned")?.message).toContain(
    "Nombre del juego",
  );
  expect(findings.find((finding) => finding.entry.id === "wishlist")?.message).not.toContain(
    "Lanzamiento",
  );
  expect(
    dataChecks([entry({ id: "empty-release", release: "", year: 2025 })]).find(
      (finding) => finding.kind === "completion",
    )?.message,
  ).toContain("Lanzamiento");
});

it("accepts zero priority, No access, nonblank required fields, and recognized legacy releases", () => {
  const ready = entry({
    status: "wishlist",
    priority: 0,
    ownership: "No",
    estimated: "2-4",
    sourceSnapshot: {
      raw: { cells: [{ header: "Fecha de Salida", value: 2024 }] },
    },
  });
  expect(dataChecks([ready]).map((finding) => finding.kind)).not.toContain(
    "completion",
  );
});
