import { test, expect, type Page, type Route } from "@playwright/test";

async function fixture(page: Page, withOlder = false) {
  const pending: Route[] = [];
  const read = new Set<string>();
  let failRefresh = false;
  const items = [1, 2, 3, 4].map((i) => ({
    id: "10000000-0000-4000-8000-" + String(i).padStart(12, "0"),
    title: "Aviso " + i,
    body: "Oferta de prueba",
    read_at: null as string | null,
    kind: "discount",
    url: "/?tab=wishlist",
    created_at: "2026-10-21T10:00:00Z",
  }));
  const calls: string[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(route.request().method() + " " + url.pathname);
    if (url.pathname === "/api/notifications") {
      if (route.request().method() === "PATCH") {
        pending.push(route);
        return;
      }
      if (failRefresh)
        return route.fulfill({
          status: 503,
          json: { error: "No se pudo actualizar", code: "TEMPORARY" },
        });
      const all = items.map((n) => ({
        ...n,
        read_at: read.has(n.id) ? "2026-10-23T10:00:00Z" : null,
      }));
      return route.fulfill({
        json: {
          items: (url.searchParams.has("cursor")
            ? all.slice(3)
            : all.slice(0, 3)
          ).filter(
            (n) => url.searchParams.get("read") !== "unread" || !n.read_at,
          ),
          unreadCount: 5 - read.size,
          nextCursor:
            withOlder && !url.searchParams.has("cursor") ? "older" : null,
          checkedAt: "2026-10-23T11:00:00Z",
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/records"
          ? { records: [], member: { display_name: "Fixture", role: "member" } }
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/backups"
              ? {
                  checkedAt: "2026-10-23T11:00:00Z",
                  lastSuccess: null,
                  latest: null,
                }
              : [],
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Ver notificaciones" }).click();
  const drawer = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(drawer.getByText("Aviso 1", { exact: true })).toBeVisible();
  return {
    drawer,
    pending,
    read,
    items,
    calls,
    failNextRefresh: () => {
      failRefresh = true;
    },
  };
}

test("individual read updates immediately and a failed concurrent read restores only its own item", async ({
  page,
}) => {
  const f = await fixture(page);
  const item = (title: string) =>
    f.drawer.locator("li.notification").filter({ hasText: title });
  await item("Aviso 1")
    .getByRole("button", { name: "Marcar como leída", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(item("Aviso 1")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("4");
  await item("Aviso 2")
    .getByRole("button", { name: "Marcar como leída", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(2);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("3");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(item("Aviso 1")).toHaveCount(0);
  await expect(item("Aviso 2")).toHaveCount(0);
  f.read.add(f.items[0].id);
  await f.pending[0].fulfill({ json: { ok: true } });
  await f.pending[1].fulfill({
    status: 503,
    json: { error: "No se pudo guardar la lectura", code: "TEMPORARY" },
  });
  await expect(f.drawer.getByRole("alert")).toContainText(
    "No se pudo guardar la lectura",
  );
  await expect(item("Aviso 2")).toBeVisible();
  await expect(item("Aviso 1")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("4");
  await item("Aviso 2")
    .getByRole("button", { name: "Marcar como leída", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(3);
  f.read.add(f.items[1].id);
  await f.pending[2].fulfill({ json: { ok: true } });
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("3");
});

test("mark all is immediate, closing stays responsive, and refresh failure does not undo a saved read", async ({
  page,
}) => {
  const f = await fixture(page);
  const before = f.calls.filter(
    (c) => !c.endsWith("/api/notifications"),
  ).length;
  await f.drawer
    .getByRole("button", { name: "Marcar todas como leídas" })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(f.drawer).toContainText("0 sin leer en total");
  await expect(f.drawer.locator("li.notification")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("0");
  await page.keyboard.press("Escape");
  await expect(f.drawer).toHaveCount(0);
  await page.getByRole("button", { name: "Ver notificaciones" }).click();
  await expect(f.drawer).toContainText("0 sin leer en total");
  f.failNextRefresh();
  await f.pending[0].fulfill({ json: { ok: true } });
  await expect(f.drawer.getByRole("alert")).toContainText(
    "No se pudo actualizar",
  );
  await expect(f.drawer.locator("li.notification")).toHaveCount(0);
  expect(f.calls.filter((c) => !c.endsWith("/api/notifications")).length).toBe(
    before,
  );
});

test("all view keeps the notification visible but removes its read button before saving", async ({
  page,
}) => {
  const f = await fixture(page);
  await f.drawer.getByLabel("Mostrar").selectOption("all");
  const item = f.drawer
    .locator("li.notification")
    .filter({ hasText: "Aviso 1" });
  await item
    .getByRole("button", { name: "Marcar como leída", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(item).toBeVisible();
  await expect(item).not.toHaveClass(/unread/);
  await expect(
    item.getByRole("button", { name: "Marcar como leída", exact: true }),
  ).toHaveCount(0);
  await f.pending[0].fulfill({
    status: 503,
    json: { error: "No se pudo guardar la lectura", code: "TEMPORARY" },
  });
  await expect(item).toHaveClass(/unread/);
  await expect(
    item.getByRole("button", { name: "Marcar como leída", exact: true }),
  ).toBeEnabled();
});

test("marking read from settings also updates a previously opened drawer immediately", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Marcar como leídas", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("0");
  await page.getByRole("button", { name: "Ver notificaciones" }).click();
  await expect(f.drawer.locator("li.notification")).toHaveCount(0);
  await expect(f.drawer).toContainText("0 sin leer en total");
  await f.pending[0].fulfill({
    status: 503,
    json: { error: "No se pudo guardar la lectura", code: "TEMPORARY" },
  });
  await expect(f.drawer.locator("li.notification")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("5");
});

test("a failed read of a paginated notification restores it even when refreshing also fails", async ({
  page,
}) => {
  const f = await fixture(page, true);
  await f.drawer.getByRole("button", { name: "Cargar más" }).click();
  const older = f.drawer
    .locator("li.notification")
    .filter({ hasText: "Aviso 4" });
  await expect(older).toBeVisible();
  await older
    .getByRole("button", { name: "Marcar como leída", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(older).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("4");
  f.failNextRefresh();
  await f.pending[0].fulfill({
    status: 503,
    json: { error: "No se pudo guardar la lectura", code: "TEMPORARY" },
  });
  await expect(older).toBeVisible();
  await expect(f.drawer.locator("li.notification")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Ver notificaciones", includeHidden: true })).toHaveText("5");
});
