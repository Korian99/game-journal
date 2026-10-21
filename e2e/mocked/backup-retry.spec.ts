import { test, expect } from "@playwright/test";
test("a successful backup retry clears the previous action error", async ({
  page,
}) => {
  let attempts = 0;
  const checkedAt = "2026-10-21T10:00:00Z";
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/backups/drive") {
      if (route.request().method() === "POST") {
        attempts++;
        return attempts === 1
          ? route.fulfill({
              status: 503,
              json: { error: "Previous retry failed", code: "TEMPORARY" },
            })
          : route.fulfill({ json: { processed: true, status: "succeeded" } });
      }
      return route.fulfill({
        json: {
          configured: true,
          connected: true,
          state: "connected",
          folderId: "fixture-folder",
          errorCode: null,
          recoveryVerifiedAt: null,
          latest: null,
          lastSuccess: null,
          checkedAt,
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/records"
          ? { records: [], member: { display_name: "Fixture", role: "member" } }
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/notifications"
              ? { items: [], unreadCount: 0, nextCursor: null, checkedAt }
              : url.pathname === "/api/backups"
                ? { checkedAt, lastSuccess: null, latest: null }
                : [],
    });
  });
  await page.goto("./?tab=settings");
  const panel = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Copia en Google Drive",
        exact: true,
      }),
    });
  await panel
    .getByRole("button", { name: "Reintentar copia", exact: true })
    .click();
  await expect(
    panel.getByRole("alert").filter({ hasText: "Previous retry failed" }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Reintentar copia", exact: true })
    .click();
  await expect.poll(() => attempts).toBe(2);
  await expect(
    panel.getByRole("button", { name: "Reintentar copia", exact: true }),
  ).toBeEnabled();
  await expect(
    panel.getByRole("alert").filter({ hasText: "Previous retry failed" }),
  ).toHaveCount(0);
});
