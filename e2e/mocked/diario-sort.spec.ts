import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

test("Diario breaks period ties by start, finish, and name on desktop and mobile", async ({
  page,
}) => {
  const variants = [
    { title: "Zulu same dates", started: "02/01/2025", finished: "2025-03-02" },
    {
      title: "Alpha earlier start",
      started: "01/01/2025",
      finished: "2025-12-31",
    },
    {
      title: "Bravo same dates",
      started: "2025-01-02",
      finished: "02/03/2025",
    },
    {
      title: "Alpha earlier finish",
      started: "2025-01-02",
      finished: "2025-03-01",
    },
    { title: "No finish", started: "2025-01-02" },
    { title: "No start later finish", finished: "2025-12-31" },
    { title: "No start earlier finish", finished: "01/12/2025" },
    { title: "Zulu no dates" },
    { title: "Alpha no dates" },
    { title: "Older period", period: "2024", started: "2026-01-01" },
    { title: "Unknown period", period: "", started: "2027-01-01" },
    { title: "Newer period", period: "2026", started: "2024-01-01" },
  ];
  const records = variants.map((variant, index) => ({
    ...emptyRecord,
    status: "completed",
    period: "2025",
    ...variant,
    id: "20000000-0000-4000-8000-" + String(100000000000 + index),
    gameId: "30000000-0000-4000-8000-" + String(100000000000 + index),
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/api/records"
          ? { records, member: { role: "member", display_name: "Fixture" } }
          : path === "/api/notifications"
            ? {
                items: [],
                unreadCount: 0,
                nextCursor: null,
                checkedAt: "2026-10-23T10:00:00Z",
              }
            : path === "/api/sharing"
              ? { shared: [], members: [], grants: [] }
              : path === "/api/backups"
                ? {
                    checkedAt: "2026-10-23T10:00:00Z",
                    latest: null,
                    lastSuccess: null,
                  }
                : [],
    });
  });
  const descending = [
    "Newer period",
    "Bravo same dates",
    "Zulu same dates",
    "Alpha earlier finish",
    "No finish",
    "Alpha earlier start",
    "No start later finish",
    "No start earlier finish",
    "Alpha no dates",
    "Zulu no dates",
    "Older period",
    "Unknown period",
  ];
  const ascending = [
    "Older period",
    "Alpha earlier start",
    "Alpha earlier finish",
    "Bravo same dates",
    "Zulu same dates",
    "No finish",
    "No start earlier finish",
    "No start later finish",
    "Alpha no dates",
    "Zulu no dates",
    "Newer period",
    "Unknown period",
  ];
  const titles = page.locator("table .game-data-row .game-cell strong");
  await page.goto("./?tab=journal&year=all");
  await expect(titles).toHaveText(descending);
  // Existing bookmarked sorts use the same tie-breakers, even without title in the URL.
  await page.goto("./?tab=journal&year=all&sort=period.desc");
  await expect(titles).toHaveText(descending);
  await page.getByRole("button", { name: "Período", exact: true }).click();
  await expect(titles).toHaveText(ascending);
  await page.reload();
  await expect(titles).toHaveText(ascending);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-games .mobile-game strong")).toHaveText(
    ascending,
  );
});
