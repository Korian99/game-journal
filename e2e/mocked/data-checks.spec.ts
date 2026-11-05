import type { JournalEntry } from "../../src/lib/journal/journal-types";
import { test, expect, type Page, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
const id = (n: number) =>
  "20000000-0000-4000-8000-" + String(n).padStart(12, "0");
async function setup(page: Page) {
  let records: JournalEntry[] = [
    {
      ...emptyRecord,
      id: id(1),
      gameId: id(11),
      title: "Bad date",
      status: "completed",
      year: 2025,
      started: "32/01/2025",
      finished: "",
      hours: 0,
      rating: 0,
      device: "PC",
      updated_at: "2026-10-26T12:00:00Z",
    },
    {
      ...emptyRecord,
      id: id(2),
      gameId: id(12),
      title: "Missing optional",
      status: "completed",
      year: 2025,
      started: "01/01/2025",
      hours: null,
      rating: null,
      device: "PC",
      updated_at: "2026-10-26T12:00:00Z",
    },
    {
      ...emptyRecord,
      id: id(3),
      gameId: id(13),
      title: "Approximate memory",
      status: "remembered",
      year: 2025,
      started: "Around 2010",
      period: "2008-2010",
      device: "PC",
      hours: 0,
      rating: 0,
    },
  ];
  let state = {
    preferences: { review: false, console: false, hours: false },
    dismissals: [] as { entry_id: string; kind: string; values: unknown[] }[],
  };
  const pending: Route[] = [];
  let failedRead = false;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records" && route.request().method() === "POST") {
      const saved = route.request().postDataJSON();
      records = records.map((record) =>
        record.id === id(5) ? { ...record, ...saved } : record,
      );
      return route.fulfill({
        json: { id: id(5), gameId: id(15), record: saved },
      });
    }
    if (path === "/api/records")
      return route.fulfill({
        json: { records, member: { display_name: "Fixture", role: "member" } },
      });
    if (path === "/api/data-checks") {
      if (route.request().method() === "POST") {
        pending.push(route);
        return;
      }
      return failedRead
        ? route.fulfill({
            status: 503,
            json: { error: "Settings unavailable" },
          })
        : route.fulfill({ json: state });
    }
    return route.fulfill({
      json:
        path === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : path === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : path === "/api/scoring"
              ? { entries: [{ score_threshold: 100, meaning: "Fixture" }] }
              : [],
    });
  });
  return {
    pending,
    set failure(v: boolean) {
      failedRead = v;
    },
    change(patch: Partial<(typeof records)[number]>) {
      records = records.map((r) => (r.id === id(1) ? { ...r, ...patch } : r));
    },
    addIncomplete() {
      records = [
        ...records,
        {
          ...emptyRecord,
          id: id(4),
          gameId: id(14),
          title: " ",
          status: "upcoming",
          release: "",
          hype: "",
        },
        {
          ...emptyRecord,
          id: id(5),
          gameId: id(15),
          title: "Needs hype",
          status: "upcoming",
          year: 2025,
          hype: "",
        },
      ];
    },
    async succeed(index: number) {
      const c = pending[index].request().postDataJSON();
      if (c.action === "preference")
        state.preferences[c.key as keyof typeof state.preferences] = c.enabled;
      else if (c.action === "dismiss")
        state.dismissals.push({
          entry_id: c.entryId,
          kind: c.kind,
          values: c.values,
        });
      else
        state.dismissals = state.dismissals.filter(
          (d) => d.entry_id !== c.entryId || d.kind !== c.kind,
        );
      await pending[index].fulfill({ json: state });
    },
  };
}
test("checks all active records independently of list filters and makes reminders opt-in", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=settings&q=unrelated&year=2030");
  const panel = page.locator(".data-checks");
  await expect(
    panel.getByRole("heading", { name: "Revisar datos", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".data-check-finding")).toHaveCount(1);
  await expect(panel).toContainText("Bad date");
  await expect(panel).not.toContainText("Approximate memory");
  await panel
    .getByRole("checkbox", { name: "Terminados sin reseña", exact: true })
    .check();
  await expect.poll(() => f.pending.length).toBe(1);
  await f.succeed(0);
  await expect(panel.locator(".data-check-finding")).toHaveCount(2);
  await panel
    .getByLabel("Tipo de aviso", { exact: true })
    .selectOption("missing-review");
  await expect(panel.locator(".data-check-finding")).toHaveCount(1);
  await expect(panel).toContainText("Missing optional");
  await page.reload();
  await expect(panel.getByLabel("Tipo de aviso", { exact: true })).toHaveValue(
    "missing-review",
  );
  await expect(
    panel.getByRole("checkbox", { name: "Terminados sin reseña", exact: true }),
  ).toBeChecked();
});
test("completion findings are default visible, URL filterable and open the editable entry", async ({
  page,
}) => {
  const f = await setup(page);
  f.addIncomplete();
  await page.goto("./?tab=settings&checkCategory=completion&checkKind=completion");
  const panel = page.locator(".data-checks");
  await expect(panel.getByLabel("Categoría de aviso")).toHaveValue("completion");
  await expect(panel.getByLabel("Tipo de aviso")).toHaveValue("completion");
  const finding = panel.locator(".data-check-finding");
  await expect(finding).toHaveCount(2);
  const blankName = finding.filter({ has: page.getByRole("heading", { name: "Juego sin nombre" }) });
  await expect(blankName).toContainText("Próximo");
  await expect(blankName).toContainText("Nombre del juego, Lanzamiento, Hype");
  await expect(blankName.getByRole("button", { name: /Ocultar aviso/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const needsHype = finding.filter({ has: page.getByRole("heading", { name: "Needs hype" }) });
  await needsHype.getByRole("button", { name: "Editar Needs hype" }).click();
  await expect(page.getByRole("dialog", { name: "Tu partida" })).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "Tu partida" });
  await dialog.getByRole("tab", { name: "Más", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Hype", exact: true }).selectOption("Medio");
  await dialog.getByRole("button", { name: "Guardar entrada", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.locator(".data-check-finding")).toHaveCount(1);
  await expect(panel).not.toContainText("Needs hype");
});
test("hiding persists across unrelated edits, restores explicitly and returns for changed facts", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=settings");
  const panel = page.locator(".data-checks");
  await panel
    .getByRole("button", { name: "Ocultar aviso de Bad date", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await f.succeed(0);
  await expect(panel.locator(".data-check-finding")).toHaveCount(0);
  f.change({
    title: "Renamed",
    notes: "Unrelated",
    updated_at: "2026-10-26T13:00:00Z",
  });
  await page.reload();
  await expect(panel.locator(".data-check-finding")).toHaveCount(0);
  await panel
    .getByRole("checkbox", { name: "Mostrar ocultos", exact: true })
    .check();
  await expect(panel.locator(".data-check-finding")).toHaveCount(1);
  await panel
    .getByRole("button", { name: "Mostrar aviso de Renamed", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(2);
  await f.succeed(1);
  await panel
    .getByRole("checkbox", { name: "Mostrar ocultos", exact: true })
    .uncheck();
  await expect(panel.locator(".data-check-finding")).toHaveCount(1);
  await panel
    .getByRole("button", { name: "Ocultar aviso de Renamed", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(3);
  await f.succeed(2);
  f.change({ started: "31/02/2025" });
  await page.reload();
  await expect(panel.locator(".data-check-finding")).toHaveCount(1);
});
test("failed writes keep the finding and failed loads are distinct from empty results", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=settings");
  const panel = page.locator(".data-checks");
  await panel
    .getByRole("button", { name: "Ocultar aviso de Bad date", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await f.pending[0].fulfill({
    status: 409,
    json: { error: "Finding changed", code: "CONFLICT" },
  });
  await expect(panel.getByRole("alert")).toContainText("Finding changed");
  await expect(panel.locator(".data-check-finding")).toHaveCount(1);
  f.failure = true;
  await page.reload();
  await expect(panel.getByRole("alert")).toContainText("Settings unavailable");
  await expect(
    panel.getByRole("button", {
      name: "Ocultar aviso de Bad date",
      exact: true,
    }),
  ).toBeDisabled();
});
test("view and edit use the exact entry and mobile stays within its viewport", async ({
  page,
}) => {
  await setup(page);
  await page.goto("./?tab=settings");
  const panel = page.locator(".data-checks");
  await panel
    .getByRole("button", { name: "Ver juego Bad date", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("tab=library.*entry=" + id(1)));
  await expect(page.locator("tr.notification-highlight")).toContainText(
    "Bad date",
  );
  await page.goBack();
  await panel
    .getByRole("button", { name: "Editar Bad date", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Tu partida" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: "test-results/data-checks-mobile.png",
    animations: "disabled",
  });
});
