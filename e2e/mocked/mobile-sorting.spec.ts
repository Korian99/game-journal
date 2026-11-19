import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

const collectionViews = [
  {
    view: "library",
    label: "Ordenar Biblioteca",
    sortIds: ["title", "status", "started", "finished", "hours", "rating", "reason", "impression", "notes"],
    exampleField: "hours",
    exampleSort: "hours.desc,title.asc",
    exampleDirection: "ascendente",
  },
  {
    view: "journal",
    label: "Ordenar Histórico",
    sortIds: ["title", "year", "period", "rating", "notes"],
    exampleField: "year",
    exampleSort: "year.desc,title.asc",
    exampleDirection: "ascendente",
  },
  {
    view: "wishlist",
    label: "Ordenar Lista de deseos",
    sortIds: ["title", "priority", "ownership", "estimated"],
    exampleField: "priority",
    exampleSort: null,
    exampleDirection: "descendente",
  },
  {
    view: "upcoming",
    label: "Ordenar Próximos",
    sortIds: ["title", "year", "hype"],
    exampleField: "year",
    exampleSort: null,
    exampleDirection: "descendente",
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

  for (const { view, label, sortIds, exampleField, exampleSort, exampleDirection } of collectionViews) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`./?tab=${view}&year=all&sort=none`);
    const sort = page.getByLabel(label, { exact: true });
    await expect(sort).toBeVisible();
    expect(
      await sort
        .locator("option")
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        ),
    ).toEqual(["", ...sortIds]);
    await expect(page.getByRole("button", { name: "Cambiar dirección del orden" })).toBeDisabled();
    await sort.selectOption(exampleField);
    await expect(page.getByRole("button", { name: `Cambiar a orden ${exampleDirection}` })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("sort")).toBe(exampleSort);
    await page.screenshot({
      path: `test-results/mobile-sorting-${view}-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });

    if (view === "journal") {
      await page.goto("./?tab=journal&year=all&sort=title.asc");
      await page.getByRole("button", { name: "Juego", exact: true }).click();
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(
        "title",
      );
      await expect(page.getByRole("button", { name: "Cambiar a orden ascendente" })).toBeVisible();
    }

    await page.goto(`./?tab=${view}&year=all&sort=title.desc`);
    await expect(sort).toHaveValue("title");
    await expect(
      page.locator(".table-scroll .game-data-row").first(),
    ).toContainText("Zulu fixture");
    await page.reload();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      "title",
    );
    expect(new URL(page.url()).searchParams.get("sort")).toBe("title.desc");

    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`./?tab=${view}&year=all`);
      const mobileSort = page.getByLabel(label, { exact: true });
      await expect(mobileSort).toBeVisible();
      await mobileSort.selectOption("title");
      await expect(
        page.locator(
          view === "journal" || view === "library"
            ? ".mobile-games .notebook-entry-identity h2"
            : ".mobile-games .mobile-game-wrapper .mobile-game-info strong",
        ),
      ).toHaveText(["Alpha fixture", "Zulu fixture"]);
      await page.getByRole("button", { name: "Cambiar a orden descendente" }).press("Enter");
      await expect(
        page.locator(
          view === "journal" || view === "library"
            ? ".mobile-games .notebook-entry-identity h2"
            : ".mobile-games .mobile-game-wrapper .mobile-game-info strong",
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
      await page.reload();
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(
        "title",
      );
      await expect(page.getByRole("button", { name: "Cambiar a orden ascendente" })).toBeVisible();
      await mobileSort.selectOption("");
      expect(new URL(page.url()).searchParams.get("sort")).toBe("none");
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "./?tab=journal&year=all&sort=rating.desc,period.asc,title.desc",
  );
  const custom = page.getByLabel("Ordenar Histórico", { exact: true });
  await expect(custom).toHaveValue("custom");
  await page.reload();
  expect(new URL(page.url()).searchParams.get("sort")).toBe(
    "rating.desc,period.asc,title.desc",
  );
  await page.getByRole("button", { name: "Cambiar a orden ascendente" }).click();
  await expect(custom).toHaveValue("custom");
  expect(new URL(page.url()).searchParams.get("sort")).toBe(
    "rating.asc,period.asc,title.desc",
  );
});
