import { test, expect, type Page, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
const eventId = "10000000-0000-4000-8000-000000000001";
const targetId = "20000000-0000-4000-8000-000000000001";
const gameId = "30000000-0000-4000-8000-000000000001";
async function setup(page: Page, moved = false, missing = false) {
  const pending: Route[] = [];
  const target = {
    ...emptyRecord,
    id: targetId,
    gameId,
    title: "The notification game",
    status: moved ? "completed" : "wishlist",
    priority: "99",
    started: "2025-01-01",
    period: "2025",
  };
  const records = [
    ...Array.from({ length: 28 }, (_, i) => ({
      ...emptyRecord,
      id: "20000000-0000-4000-8000-" + String(100000000000 + i),
      gameId: "30000000-0000-4000-8000-" + String(100000000000 + i),
      title: "Other game " + i,
      status: target.status,
      priority: "1",
      started: "2026-01-01",
      period: "2026",
    })),
    ...(missing ? [] : [target]),
  ];
  const event = {
    id: eventId,
    title: "New discount for the target",
    body: "USD 8 · 50% OFF",
    kind: "discount",
    game_id: gameId,
    created_at: "2026-10-23T10:00:00Z",
    read_at: null as string | null,
    url: "/?tab=wishlist",
  };
  let lookedUp = false;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/notifications") {
      if (route.request().method() === "PATCH") {
        pending.push(route);
        return;
      }
      if (url.searchParams.has("id")) lookedUp = true;
      return route.fulfill({
        json: {
          items:
            url.searchParams.get("read") === "unread" && event.read_at
              ? []
              : [event],
          unreadCount: event.read_at ? 0 : 1,
          nextCursor: null,
          checkedAt: "2026-10-23T11:00:00Z",
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/records"
          ? { records, member: { display_name: "Fixture", role: "member" } }
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/backups"
              ? {
                  checkedAt: "2026-10-23T11:00:00Z",
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  return { pending, event, records, lookedUp: () => lookedUp };
}
for (const mobile of [false, true])
  test(
    (mobile ? "mobile" : "desktop") +
      " clicking a notification reveals, focuses, and highlights its game before the read saves",
    async ({ page }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const f = await setup(page);
      await page.goto(
        "./?tab=wishlist&q=hidden&platform=Nintendo+Switch&discount=discounted",
      );
      await page.getByRole("button", { name: "Ver notificaciones" }).click();
      const drawer = page.getByRole("dialog", { name: "Notificaciones" });
      await drawer
        .getByRole("link", { name: /New discount for the target/ })
        .click();
      await expect(drawer).toHaveCount(0);
      await expect(page).toHaveURL(
        new RegExp("tab=wishlist.*entry=" + targetId),
      );
      expect(new URL(page.url()).searchParams.has("q")).toBe(false);
      expect(new URL(page.url()).searchParams.has("platform")).toBe(false);
      expect(new URL(page.url()).searchParams.has("discount")).toBe(false);
      const target = page.locator(
        mobile
          ? ".mobile-game.notification-highlight"
          : ".game-data-row.notification-highlight",
      );
      await expect(target).toContainText("The notification game");
      const button = mobile ? target : target.locator(".game-cell");
      await expect(button).toBeFocused();
      await expect(target).toBeInViewport();
      await page.screenshot({
        path:
          "test-results/notification-focus-" +
          (mobile ? "mobile" : "desktop") +
          ".png",
      });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect.poll(() => f.pending.length).toBe(1);
      // A failed read must not undo navigation or lose the highlight.
      await f.pending[0].fulfill({
        status: 503,
        json: { error: "No se pudo guardar la lectura", code: "TEMPORARY" },
      });
      await expect(target).toHaveCount(1);
      await page.reload();
      await expect(target).toBeInViewport();
      await expect(button).toBeFocused();
    },
  );
test("a phone deep link locates a game in its current tab, even after it moved out of the wishlist", async ({
  page,
}) => {
  const f = await setup(page, true);
  await page.goto("./?tab=wishlist&notification=" + eventId);
  await expect(page).toHaveURL(new RegExp("tab=library.*entry=" + targetId));
  const target = page.locator(".game-data-row.notification-highlight");
  await expect(target).toContainText("The notification game");
  await expect(target).toBeInViewport();
  await expect(target.locator(".game-cell")).toBeFocused();
  await page.locator(".notebook-library-filters summary").click();
  await expect(
    page.getByRole("combobox", { name: "Filtrar año", exact: true }),
  ).toHaveValue("");
  await expect.poll(() => f.pending.length).toBe(1);
  f.event.read_at = "2026-10-23T12:00:00Z";
  await f.pending[0].fulfill({ json: { ok: true } });
});
test("an alert for a missing or trashed game opens its tab without highlighting another entry", async ({
  page,
}) => {
  const f = await setup(page, false, true);
  await page.goto("./?tab=journal&notification=" + eventId);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Este juego ya no está en las entradas activas." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/tab=wishlist/);
  await expect(page.locator(".notification-highlight")).toHaveCount(0);
  await expect.poll(() => f.pending.length).toBe(1);
  f.event.read_at = "2026-10-23T12:00:00Z";
  await f.pending[0].fulfill({ json: { ok: true } });
});

test("clicking an alert before records load waits instead of reporting the game missing", async ({
  page,
}) => {
  const f = await setup(page);
  let pendingRecords: Route | undefined;
  await page.route("**/api/records?**", (route) => {
    pendingRecords = route;
  });
  await page.goto("./?tab=library");
  await page.getByRole("button", { name: "Ver notificaciones" }).click();
  await page
    .getByRole("dialog", { name: "Notificaciones" })
    .getByRole("link", { name: /New discount for the target/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Este juego ya no está en las entradas activas." }),
  ).toHaveCount(0);
  await expect.poll(() => !!pendingRecords).toBe(true);
  await pendingRecords!.fulfill({
    json: {
      records: f.records,
      member: { display_name: "Fixture", role: "member" },
    },
  });
  await expect(page).toHaveURL(new RegExp("tab=wishlist.*entry=" + targetId));
  await expect(
    page.locator(".game-data-row.notification-highlight"),
  ).toBeInViewport();
  await expect.poll(() => f.pending.length).toBe(1);
  f.event.read_at = "2026-10-23T12:00:00Z";
  await f.pending[0].fulfill({ json: { ok: true } });
});

test("a late phone-link lookup cannot override a later tab choice", async ({
  page,
}) => {
  const f = await setup(page);
  let lookup: Route | undefined;
  await page.route("**/api/notifications?id=**", (route) => {
    lookup = route;
  });
  await page.goto("./?tab=wishlist&notification=" + eventId);
  await expect.poll(() => !!lookup).toBe(true);
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await lookup!.fulfill({
    json: {
      items: [f.event],
      unreadCount: 1,
      nextCursor: null,
      checkedAt: "2026-10-23T11:00:00Z",
    },
  });
  await expect(page).toHaveURL(/tab=library/);
  await expect(page.locator(".notification-highlight")).toHaveCount(0);
  expect(f.pending).toHaveLength(0);
});
test("the settings news list uses the same game navigation", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=settings");
  await page.getByRole("link", { name: /New discount for the target/ }).click();
  await expect(page).toHaveURL(new RegExp("tab=wishlist.*entry=" + targetId));
  await expect(
    page.locator(".game-data-row.notification-highlight"),
  ).toBeInViewport();
  await expect.poll(() => f.pending.length).toBe(1);
  f.event.read_at = "2026-10-23T12:00:00Z";
  await f.pending[0].fulfill({ json: { ok: true } });
});
