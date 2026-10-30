import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

const collectionViews = [
  {
    view: "journal",
    label: "Ordenar Diario",
    sortIds: [
      "title.asc",
      "title.desc",
      "year.asc",
      "year.desc",
      "period.asc",
      "period.desc",
      "rating.asc",
      "rating.desc",
      "notes.asc",
      "notes.desc",
    ],
    status: "completed",
  },
  {
    view: "wishlist",
    label: "Ordenar Lista de deseos",
    sortIds: [
      "title.asc",
      "title.desc",
      "priority.asc",
      "priority.desc",
      "ownership.asc",
      "ownership.desc",
      "estimated.asc",
      "estimated.desc",
    ],
    status: "wishlist",
  },
  {
    view: "upcoming",
    label: "Ordenar Próximos",
    sortIds: [
      "title.asc",
      "title.desc",
      "year.asc",
      "year.desc",
      "hype.asc",
      "hype.desc",
    ],
    status: "upcoming",
  },
] as const;

test("collection sorting is visible, usable on mobile, and keeps URL sort state", async ({
  page,
}) => {
  const records = (["completed", "wishlist", "upcoming"] as const).flatMap(
    (status, group) =>
      ["Zulu fixture", "Alpha fixture"].map((title, index) => {
        const id = group * 2 + index + 1;
        return {
          ...emptyRecord,
          id: `20000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
          gameId: `30000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
          title,
          status,
          period: "2025",
          year: 2025,
          rating: index ? 70 : 90,
          priority: index ? "2" : "1",
          ownership: index ? "owned" : "not-owned",
          estimated: index ? "5" : "10",
          hype: index ? "Bajo" : "Hyper",
        };
      }),
  );

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
                checkedAt: "2026-10-30T10:00:00Z",
              }
            : path === "/api/sharing"
              ? { shared: [], members: [], grants: [] }
              : path === "/api/backups"
                ? {
                    checkedAt: "2026-10-30T10:00:00Z",
                    latest: null,
                    lastSuccess: null,
                  }
                : [],
    });
  });

  for (const { view, label, sortIds } of collectionViews) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`./?tab=${view}&year=all`);
    const sort = page.getByLabel(label, { exact: true });
    await expect(sort).toBeVisible();
    expect(
      await sort
        .locator("option")
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        ),
    ).toEqual(["", ...sortIds]);
    await page.screenshot({
      path: `test-results/mobile-sorting-${view}-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });

    if (view === "journal") {
      await page.goto("./?tab=journal&year=all&sort=title.asc");
      await page.getByRole("button", { name: "Juego", exact: true }).click();
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(
        "title.desc",
      );
    }

    await page.goto(`./?tab=${view}&year=all&sort=title.desc`);
    await expect(sort).toHaveValue("title.desc");
    await expect(
      page.locator(".table-scroll .game-data-row").first(),
    ).toContainText("Zulu fixture");
    await page.reload();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      "title.desc",
    );
    expect(new URL(page.url()).searchParams.get("sort")).toBe("title.desc");

    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`./?tab=${view}&year=all`);
      const mobileSort = page.getByLabel(label, { exact: true });
      await expect(mobileSort).toBeVisible();
      await mobileSort.selectOption("title.desc");
      await expect(
        page.locator(
          ".mobile-games .mobile-game-wrapper .mobile-game-info strong",
        ),
      ).toHaveText(["Zulu fixture", "Alpha fixture"]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/mobile-sorting-${view}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.goto(`./?tab=${view}&year=all&sort=title.desc`);
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(
        "title.desc",
      );
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "./?tab=journal&year=all&sort=rating.desc,period.asc,title.desc",
  );
  const custom = page.getByLabel("Ordenar Diario", { exact: true });
  await expect(custom).toHaveValue("custom");
  await page.reload();
  expect(new URL(page.url()).searchParams.get("sort")).toBe(
    "rating.desc,period.asc,title.desc",
  );
});
