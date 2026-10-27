import type { JournalEntry } from "../../src/lib/journal/journal-types";
import { test, expect, type Page, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
import { datesAfterStatusChange } from "../../src/lib/journal/entry-status";
import { periodAfterDateEdits } from "../../src/lib/journal/entry-period";
import { recordSchema } from "../../src/lib/validation";
const id = (n: number) =>
  "20000000-0000-4000-8000-" + String(n).padStart(12, "0");
const gameId = (n: number) =>
  "30000000-0000-4000-8000-" + String(n).padStart(12, "0");
const rows: JournalEntry[] = (
  [
    {
      title: "Long paused",
      status: "paused",
      estimated: "20",
      hours: 15,
      started: "01/01/2020",
      period: "2020",
      platforms: "PC",
    },
    {
      title: "Short owned",
      status: "wishlist",
      estimated: "8",
      platforms: "Switch 2",
    },
    {
      title: "Family choice",
      status: "wishlist",
      estimated: "5 - 8 - 12",
      ownership: "En Familia",
      platforms: "",
      pages: ["https://store.steampowered.com/app/620/"],
    },
    {
      title: "Unknown length",
      status: "wishlist",
      estimated: "unknown",
      platforms: "PC",
    },
    {
      title: "Another option",
      status: "wishlist",
      estimated: "4",
      platforms: "PC",
    },
    {
      title: "No terminado fixture",
      status: "abandoned",
      estimated: "1",
      priority: 0,
    },
    {
      title: "Future fixture",
      status: "wishlist",
      release: "2030-01-01",
      priority: 0,
    },
    { title: "Not bought", status: "wishlist", ownership: "No", priority: 0 },
  ] satisfies Partial<JournalEntry>[]
).map((value, index) => ({
  ...emptyRecord,
  ownership: "Si",
  priority: index + 1,
  year: 2020,
  ...value,
  id: id(index + 1),
  gameId: gameId(index + 1),
  updated_at: "2026-10-26T12:00:00Z",
}));
async function setup(page: Page) {
  let records = rows.map((row) => ({ ...row }));
  const pending: Route[] = [];
  let fail = false;
  let calls = 0;
  await page.route("**/api/**", (route) => {
    calls++;
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records") {
      if (route.request().method() === "POST") {
        pending.push(route);
        return;
      }
      return fail
        ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
        : route.fulfill({
            json: {
              records,
              member: { display_name: "Fixture", role: "member" },
            },
          });
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
            : path === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  return {
    pending,
    fail() {
      fail = true;
    },
    get calls() {
      return calls;
    },
    async succeed(index: number) {
      const input = pending[index].request().postDataJSON(),
        previous = records.find((record) => record.id === input.id)!;
      Object.assign(
        input,
        datesAfterStatusChange(
          input,
          previous,
          new Date("2026-10-26T15:00:00Z"),
        ),
      );
      input.period = periodAfterDateEdits(input, previous);
      const saved = {
        ...recordSchema.parse(input),
        updated_at: "2026-10-26T15:01:00Z",
      };
      records = records.map((record) =>
        record.id === saved.id ? { ...record, ...saved } : record,
      );
      await pending[index].fulfill({
        json: { id: saved.id, gameId: saved.gameId, record: saved },
      });
    },
  };
}
test("suggestions show three ranked owned games, exclude abandoned games and paginate without requests", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  const nav = page.getByRole("button", {
    name: "¿Qué juego ahora?",
    exact: true,
  });
  await expect(nav).toBeVisible();
  await nav.click();
  await expect(page.locator(".suggestion-card")).toHaveCount(3);
  await expect(page.locator(".suggestion-card h2")).toHaveText([
    "Long paused",
    "Short owned",
    "Family choice",
  ]);
  await expect(page.locator(".suggestions")).not.toContainText(
    "No terminado fixture",
  );
  const before = f.calls;
  await page
    .getByRole("button", { name: "Ver más opciones", exact: true })
    .click();
  await expect(page.locator(".suggestion-card h2")).toHaveText([
    "Unknown length",
    "Another option",
  ]);
  expect(f.calls).toBe(before);
  expect(f.pending).toHaveLength(0);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/suggestions-desktop.png",
  });
});
test("total-length and console filters persist and unknown estimates require opting in", async ({
  page,
}) => {
  await setup(page);
  await page.goto("./?tab=suggestions");
  await page
    .getByLabel("Duración total máxima (h)", { exact: true })
    .fill("10");
  await expect(page.locator(".suggestion-card h2")).toHaveText([
    "Short owned",
    "Family choice",
    "Another option",
  ]);
  await expect(page.locator(".suggestions")).toContainText("1 sin estimación");
  await page
    .getByRole("checkbox", { name: /Incluir duración desconocida/ })
    .check();
  await expect(page.locator(".suggestion-card h2")).toHaveText([
    "Short owned",
    "Family choice",
    "Unknown length",
  ]);
  await page.getByLabel("Consola", { exact: true }).selectOption("Switch 2");
  await expect(page.locator(".suggestion-card h2")).toHaveText(["Short owned"]);
  await page.reload();
  await expect(page.getByLabel("Consola", { exact: true })).toHaveValue(
    "Switch 2",
  );
  await expect(
    page.getByLabel("Duración total máxima (h)", { exact: true }),
  ).toHaveValue("10");
  await expect(
    page.getByRole("checkbox", { name: /Incluir duración desconocida/ }),
  ).toBeChecked();
});
test("viewing opens the exact game and browser Back restores suggestion filters", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=suggestions&platform=Switch+2&maxHours=10");
  await page
    .getByRole("button", { name: "Ver juego Short owned", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("tab=wishlist.*entry=" + id(2)));
  await expect(page.locator("tr.notification-highlight")).toContainText(
    "Short owned",
  );
  await page.goBack();
  await expect(page.getByLabel("Consola", { exact: true })).toHaveValue(
    "Switch 2",
  );
  expect(f.pending).toHaveLength(0);
});
test("starting uses the canonical save path, dates the transition and highlights the game", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=suggestions&platform=Switch+2");
  await page
    .getByRole("button", { name: "Empezar Short owned", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  expect(f.pending[0].request().postDataJSON()).toMatchObject({
    id: id(2),
    status: "playing",
    updated_at: rows[1].updated_at,
  });
  await f.succeed(0);
  await expect(page).toHaveURL(new RegExp("tab=library.*entry=" + id(2)));
  await expect(page.locator("tr.notification-highlight")).toContainText(
    "26/10/2026",
  );
});
test("a failed resume keeps suggestions usable and preserves the original start date", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=suggestions");
  await page
    .getByRole("button", { name: "Retomar Long paused", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  expect(f.pending[0].request().postDataJSON()).toMatchObject({
    started: "01/01/2020",
  });
  await f.pending[0].fulfill({
    status: 409,
    json: { error: "La entrada cambió", code: "CONFLICT" },
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "La entrada cambió" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/tab=suggestions/);
  await expect(
    page.getByRole("button", { name: "Retomar Long paused", exact: true }),
  ).toBeEnabled();
});
test("mobile controls fit without horizontal scrolling and load errors are not empty recommendations", async ({
  page,
}) => {
  const f = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?tab=suggestions");
  await expect(page.locator(".suggestion-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/suggestions-mobile.png",
    fullPage: true,
  });
  f.fail();
  await page.reload();
  await expect(page.locator(".suggestions")).toContainText(
    "No se pudieron cargar los juegos",
  );
  await expect(page.locator(".suggestion-card")).toHaveCount(0);
});

test("a dirty inline draft blocks suggestion actions until it is explicitly cancelled", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=wishlist");
  await page
    .getByRole("button", { name: "Editar Nombre de Short owned", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Unsaved name");
  await page
    .getByRole("button", { name: "¿Qué juego ahora?", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Empezar Short owned", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".suggestions")).toContainText(
    "Guardá o cancelá la edición",
  );
  expect(f.pending).toHaveLength(0);
  await page
    .getByRole("button", { name: "Cancelar edición", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Empezar Short owned", exact: true }),
  ).toBeEnabled();
});
test("a successful resume supports Undo with the canonical revision", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=suggestions");
  const resume = page.getByRole("button", {
    name: "Retomar Long paused",
    exact: true,
  });
  await resume.click();
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(resume).toBeDisabled();
  await expect(resume).toContainText("Guardando");
  await f.succeed(0);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect.poll(() => f.pending.length).toBe(2);
  expect(f.pending[1].request().postDataJSON()).toMatchObject({
    id: id(1),
    status: "paused",
    started: "01/01/2020",
    intent: "undo",
    updated_at: "2026-10-26T15:01:00Z",
  });
  await f.succeed(1);
  await expect(page.locator("tr.notification-highlight")).toContainText(
    "En pausa",
  );
});
