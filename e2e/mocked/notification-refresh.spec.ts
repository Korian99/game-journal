import { test, expect } from "@playwright/test";
import type { Route } from "@playwright/test";

test("notification history survives refresh failures and ignores an older page after refresh", async ({
  page,
}) => {
  let failHead = false;
  let failPage = false;
  let refreshed = false;
  let delayedPage: Route | undefined;
  let delayPage = false;
  const item = (id: number, title: string) => ({
    id: "10000000-0000-4000-8000-" + String(id).padStart(12, "0"),
    title,
    body: "Synthetic notification",
    read_at: null,
    kind: "discount",
    url: "/?tab=wishlist",
    created_at: "2026-10-21T10:00:00Z",
  });
  const head = () => ({
    items: [item(1, refreshed ? "New head" : "Original head")],
    unreadCount: 345,
    nextCursor: "older-page",
    checkedAt: new Date().toISOString(),
  });
  const older = {
    items: [item(2, "Older loaded notification")],
    unreadCount: 345,
    nextCursor: null,
    checkedAt: "2026-10-21T10:00:00Z",
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/notifications") {
      if (url.searchParams.has("cursor")) {
        if (failPage)
          return route.fulfill({
            status: 503,
            json: { error: "Page unavailable", code: "TEMPORARY" },
          });
        if (delayPage) {
          delayedPage = route;
          return;
        }
        return route.fulfill({ json: older });
      }
      if (url.searchParams.has("read") && failHead)
        return route.fulfill({
          status: 503,
          json: { error: "History refresh unavailable", code: "TEMPORARY" },
        });
      return route.fulfill({ json: head() });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/records"
          ? { records: [], member: { display_name: "Fixture", role: "member" } }
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
  await page.goto("./");
  await page.getByRole("button", { name: "Ver notificaciones" }).click();
  const drawer = page.getByRole("dialog", { name: "Notificaciones" });
  await expect(
    drawer.getByText("Original head", { exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Cargar más" }).click();
  await expect(
    drawer.getByText("Older loaded notification", { exact: true }),
  ).toBeVisible();

  failHead = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(drawer.getByRole("alert")).toContainText(
    "History refresh unavailable",
  );
  await expect(
    drawer.getByText("Original head", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByText("Older loaded notification", { exact: true }),
  ).toBeVisible();

  failHead = false;
  await drawer.getByRole("button", { name: "Reintentar" }).click();
  await expect(drawer.getByRole("alert")).toHaveCount(0);
  await expect(
    drawer.getByText("Older loaded notification", { exact: true }),
  ).toHaveCount(0);
  delayPage = true;
  await drawer.getByRole("button", { name: "Cargar más" }).click();
  await expect.poll(() => !!delayedPage).toBe(true);
  refreshed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(drawer.getByText("New head", { exact: true })).toBeVisible();
  await delayedPage!.fulfill({ json: older });
  await expect(
    drawer.getByRole("button", { name: "Cargar más" }),
  ).toBeEnabled();
  await expect(
    drawer.getByText("Older loaded notification", { exact: true }),
  ).toHaveCount(0);
  delayPage = false;
  failPage = true;
  await drawer.getByRole("button", { name: "Cargar más" }).click();
  await expect(drawer.getByRole("alert")).toContainText("Page unavailable");
  failPage = false;
  await drawer.getByRole("button", { name: "Reintentar" }).click();
  await expect(drawer.getByRole("alert")).toHaveCount(0);
});
