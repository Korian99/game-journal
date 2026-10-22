import { test, expect, type Page } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

async function fixtures(page: Page) {
  const records = [
    { title: "Reviewed game", rating: 84, hours: 10 },
    { title: "Zero review game", rating: 0, hours: 0 },
    {
      title: "Impressions only game",
      rating: null,
      impression: "8",
      memorability: 9,
      hours: 6,
    },
    { title: "Wishlist game", rating: null, status: "wishlist", priority: 4 },
  ].map((value, index) => ({
    ...emptyRecord,
    status: "remembered",
    period: "2024",
    id: "20000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
    gameId: "30000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
    ...value,
  }));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/api/records"
          ? { records, member: { display_name: "Fixture", role: "member" } }
          : path === "/api/notifications"
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
}
test("Diario filters actual reviews, includes zero, and restores its URL state", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("./?tab=journal");
  const filter = page.getByLabel("Filtrar reseña", { exact: true });
  const table = page.locator("table");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await filter.selectOption("with");
  await expect(page).toHaveURL(/review=with/);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(
    table.getByText("Zero review game", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByText("Impressions only game", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('[data-stat="total"] strong')).toHaveText("2");
  await page.reload();
  await expect(filter).toHaveValue("with");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await filter.selectOption("without");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(
    table.getByText("Impressions only game", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-stat="hours"] strong')).toHaveText("6");
  await page.goBack();
  await expect(filter).toHaveValue("with");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await filter.selectOption("");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  expect(new URL(page.url()).searchParams.has("review")).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await filter.selectOption("without");
  await expect(page.locator(".mobile-games .mobile-game-wrapper")).toHaveCount(
    1,
  );
  await expect(
    page
      .locator(".mobile-games")
      .getByText("Impressions only game", { exact: true }),
  ).toBeVisible();
});
test("wishlist ends at its list without duplicate offer cards", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("./?tab=wishlist");
  await expect(
    page.locator("table").getByText("Wishlist game", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".offer-grid")).toHaveCount(0);
  await expect(page.getByLabel("Filtrar reseña", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator("table .priority-mark")).toBeVisible();
});
