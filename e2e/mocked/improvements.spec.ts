import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
test("editor saves adopt canonical dates and preserve statistics URL controls", async ({
  page,
}) => {
  let record = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Stats fixture",
    period: "2026",
    hours: 20,
    estimated: "10 - 15 - 30",
    status: "playing",
    device: "PC; Switch",
    updated_at: "2026-10-21T10:00:00Z",
  };
  let payload: typeof record | undefined;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records") {
      if (route.request().method() === "POST") {
        payload = route.request().postDataJSON();
        record = {
          ...record,
          ...payload,
          finished: "2026-10-22",
          updated_at: "2026-10-22T11:00:00Z",
        };
        return route.fulfill({
          json: { id: record.id, gameId: record.gameId, record },
        });
      }
      return route.fulfill({
        json: {
          records: [record],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  lastSuccess: null,
                  latest: null,
                }
              : [],
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?year=2026");
  await page
    .locator("table")
    .getByText("Stats fixture", { exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Estado", { exact: true })
    .selectOption("completed");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => payload?.status).toBe("completed");
  expect(payload?.started).toBe("");
  expect(payload?.finished).toBe("");
  await expect(
    page
      .locator("table .library-finish-reason")
      .getByText("22/10/2026", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Estadísticas", exact: true }).click();
  await page.getByLabel("Objetivo estimado").selectOption("extras");
  await expect(page).toHaveURL(/estimateTarget=extras/);
  await expect(
    page
      .locator(".stats-metric")
      .filter({ hasText: "Horas estimadas" })
      .locator("strong"),
  ).toHaveText("15 h");
  await expect(
    page.getByRole("cell", { name: "Varias consolas", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Objetivo estimado")).toHaveValue("extras");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/statistics-mobile.png",
    fullPage: true,
  });
});
test("notification drawer has exact unread counts, pagination and targeted read actions", async ({
  page,
}) => {
  let readId: string | undefined;
  const item = {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Discount fixture",
    body: "New price",
    read_at: null,
    kind: "discount",
    url: "/?tab=wishlist",
    created_at: "2026-10-21T10:00:00Z",
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records")
      return route.fulfill({
        json: {
          records: [],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    if (url.pathname === "/api/notifications") {
      if (route.request().method() === "PATCH") {
        readId = route.request().postDataJSON().ids?.[0];
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: {
          items: url.searchParams.has("cursor")
            ? [
                {
                  ...item,
                  id: "10000000-0000-4000-8000-000000000002",
                  title: "Older fixture",
                },
              ]
            : readId
              ? []
              : [item],
          unreadCount: readId ? 344 : 345,
          nextCursor: url.searchParams.has("cursor") ? null : "cursor",
          checkedAt: new Date().toISOString(),
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/sharing"
          ? { shared: [], members: [], grants: [] }
          : url.pathname === "/api/backups"
            ? {
                checkedAt: new Date().toISOString(),
                lastSuccess: null,
                latest: null,
              }
            : [],
    });
  });
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Ver notificaciones" }),
  ).toHaveText("345");
  await page.getByRole("button", { name: "Ver notificaciones" }).click();
  const drawer = page.getByRole("dialog", { name: "Notificaciones" });
  await drawer.getByRole("button", { name: "Cargar más" }).click();
  await expect(
    drawer.getByText("Older fixture", { exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Marcar como leída", exact: true })
    .first()
    .click();
  await expect.poll(() => readId).toBe(item.id);
  await expect(page.locator(".notification-count")).toHaveText("344");
  await drawer.getByLabel("Mostrar").selectOption("all");
  await expect(page).toHaveURL(/notificationRead=all/);
  await page.screenshot({
    path: "test-results/notifications-desktop.png",
    fullPage: true,
  });
});
test("a duplicate warning keeps the draft until an explicit choice", async ({
  page,
}) => {
  const record = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Existing game",
    status: "playing",
    started: "2026-10-01",
  };
  let saves = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records") {
      if (route.request().method() === "POST") {
        saves++;
        expect(route.request().postDataJSON().allowDuplicate).toBe(true);
        return route.fulfill({
          json: { id: record.id, gameId: record.gameId, record },
        });
      }
      return route.fulfill({
        json: {
          records: [record],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  lastSuccess: null,
                  latest: null,
                }
              : [],
    });
  });
  await page.goto("./?year=2026");
  await page
    .getByRole("button", { name: "Agregar juego", exact: true })
    .click();
  await page
    .getByLabel("Nombre del juego", { exact: true })
    .fill("Existing game");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "¿Ya tenés este juego?" }),
  ).toBeVisible();
  expect(saves).toBe(0);
  await page.getByRole("button", { name: "Volver al formulario" }).click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Existing game");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar como juego separado", exact: true })
    .click();
  await expect.poll(() => saves).toBe(1);
});
