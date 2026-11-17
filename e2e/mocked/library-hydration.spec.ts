import { expect, test } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

test("legacy notebook preference cannot change the single library list during hydration", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("journal-library-layout", "notebook"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records")
      return route.fulfill({
        json: {
          records: [
            {
              ...emptyRecord,
              id: "20000000-0000-4000-8000-000000000001",
              gameId: "30000000-0000-4000-8000-000000000001",
              title: "Hydration fixture",
              status: "completed",
              period: "2026",
              updated_at: "2026-11-17T10:00:00Z",
            },
          ],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    return route.fulfill({
      json:
        path === "/api/notifications"
          ? { items: [], unreadCount: 0, nextCursor: null, checkedAt: "2026-11-17T10:00:00Z" }
          : path === "/api/notification-settings"
            ? { discounts: true, targets: true, releases: true }
            : path === "/api/sharing"
              ? { shared: [], members: [], grants: [] }
              : path.startsWith("/api/backups")
                ? { configured: false, connected: false, state: "disconnected", latest: null, lastSuccess: null }
                : [],
    });
  });

  await page.goto("./?ssrHydration&tab=library&year=all");
  await expect(page.locator(".library-table")).toBeVisible();
  await expect(page.getByRole("group", { name: "Vista de Biblioteca" })).toHaveCount(0);
  const hydration = await page.evaluate(() => ({
    serverList: (window as Window & { __journalServerList?: boolean }).__journalServerList,
    errors: (window as Window & { __journalHydrationErrors?: string[] }).__journalHydrationErrors,
    savedLayout: localStorage.getItem("journal-library-layout"),
  }));
  expect(hydration.serverList).toBe(true);
  expect(hydration.errors).toEqual([]);
  expect(hydration.savedLayout).toBe("notebook");
});
