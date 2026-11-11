import { expect, test, type Locator, type Page } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

async function fixture(page: Page, tab: "wishlist" | "upcoming") {
  let refreshStarted!: () => void;
  let finishRefresh!: (status: number) => Promise<void>;
  const records = [1, 2].map((index) => ({
    ...emptyRecord,
    id: `20000000-0000-4000-8000-00000000000${index}`,
    gameId: `30000000-0000-4000-8000-00000000000${index}`,
    title: `Refresh row ${index}`,
    status: tab,
    release: "2020-01-15",
    year: 2020,
  }));
  const offers = records.map((record, index) => ({
    id: `40000000-0000-4000-8000-00000000000${index + 1}`,
    game_id: record.gameId,
    url: `https://store.steampowered.com/app/${620 + index}/`,
    store: "steam",
    region: "AR",
    currency: "USD",
    price: 20 + index,
    regular_price: 20 + index,
    discount: 0,
    status: "available",
    checked_at: "2026-11-11T10:00:00Z",
    error: null,
    watched: true,
    target_price: null,
  }));
  const started = new Promise<void>((resolve) => (refreshStarted = resolve));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/refresh") {
      refreshStarted();
      await new Promise<void>((resolve) => {
        finishRefresh = async (status) => {
          await route.fulfill({
            status,
            json:
              status === 200
                ? { ok: true }
                : { error: "Refresh failed", code: "TEMPORARY" },
          });
          resolve();
        };
      });
      return;
    }
    if (url.pathname === "/api/records")
      return route.fulfill({
        json: { records, member: { display_name: "Fixture", role: "member" } },
      });
    if (url.pathname === "/api/offers") return route.fulfill({ json: offers });
    if (url.pathname === "/api/notifications")
      return route.fulfill({
        json: { items: [], unreadCount: 0, nextCursor: null, checkedAt: new Date().toISOString() },
      });
    if (url.pathname === "/api/sharing")
      return route.fulfill({ json: { shared: [], members: [], grants: [] } });
    if (url.pathname === "/api/backups")
      return route.fulfill({ json: { checkedAt: new Date().toISOString(), latest: null, lastSuccess: null } });
    return route.fulfill({ json: [] });
  });
  return { started, finish: (status: number) => finishRefresh(status) };
}
async function expectRowValues(
  cell: Locator,
  tab: "wishlist" | "upcoming",
  visible: boolean,
) {
  if (tab === "wishlist") {
    if (visible) await expect(cell).toContainText("US$");
    else await expect(cell).not.toContainText("US$");
    return;
  }
  if (visible) {
    await expect(cell).toContainText("15/01/2020");
    await expect(cell.getByText("Ya salió", { exact: true })).toBeVisible();
  } else {
    await expect(cell).not.toContainText("15/01/2020");
    await expect(cell.getByText("Ya salió", { exact: true })).toHaveCount(0);
  }
}

for (const tab of ["wishlist", "upcoming"] as const) {
  const pendingLabel =
    tab === "upcoming" ? "Actualizando precios y fechas…" : "Actualizando precios…";
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`${tab} refresh shows its loading state on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const api = await fixture(page, tab);
      await page.goto(`./?tab=${tab}`);
      const rows = page.locator(
        viewport.name === "mobile" ? ".mobile-game[data-entry-id]" : "tr.game-data-row",
      );
      await expect(rows).toHaveCount(2);
      for (const row of await rows.all())
        await expectRowValues(
          row.locator(tab === "wishlist" ? ".wishlist-prices" : ".upcoming-release-date"),
          tab,
          true,
        );
      const button = page.getByRole("button", { name: "Actualizar precios", exact: true });
      await expect(button).toBeVisible();
      await button.click();
      await api.started;
      const pending = page.getByRole("button", { name: pendingLabel, exact: true });
      await expect(pending).toBeDisabled();
      await expect(pending).toHaveAttribute("aria-busy", "true");
      expect(
        await pending.evaluate((node) => {
          const box = node.getBoundingClientRect();
          return box.left >= 0 && box.right <= window.innerWidth && node.scrollWidth <= node.clientWidth;
        }),
      ).toBe(true);
      const spinner = pending.locator("svg.save-spinner");
      await expect(spinner).toBeVisible();
      await expect.poll(() => spinner.evaluate((node) => getComputedStyle(node).animationName)).not.toBe("none");
      for (const row of await rows.all()) {
        const refreshCell = row.locator(
          tab === "wishlist" ? ".wishlist-prices" : ".upcoming-release-date",
        );
        await expectRowValues(refreshCell, tab, false);
        await expect(refreshCell).toHaveAttribute("aria-busy", "true");
        await expect(refreshCell.locator("svg.save-spinner")).toBeVisible();
      }
      await page.screenshot({
        path: `test-results/toolbar-refresh-${tab}-${viewport.name}.png`,
        fullPage: true,
      });
      await api.finish(200);
      const idle = page.getByRole("button", { name: "Actualizar precios", exact: true });
      await expect(idle).toBeEnabled();
      await expect(idle).toHaveAttribute("aria-busy", "false");
      for (const row of await rows.all()) {
        const refreshCell = row.locator(
          tab === "wishlist" ? ".wishlist-prices" : ".upcoming-release-date",
        );
        await expect(refreshCell).toHaveAttribute("aria-busy", "false");
        await expectRowValues(refreshCell, tab, true);
      }
    });
  }
  test(`${tab} refresh clears loading state after failure`, async ({ page }) => {
    const api = await fixture(page, tab);
    await page.goto(`./?tab=${tab}`);
    const rowRefreshCells = page.locator(
      (tab === "wishlist" ? ".wishlist-prices" : ".upcoming-release-date") +
        ":visible",
    );
    await expect(rowRefreshCells).toHaveCount(2);
    for (const cell of await rowRefreshCells.all())
      await expectRowValues(cell, tab, true);
    await page.getByRole("button", { name: "Actualizar precios", exact: true }).click();
    await api.started;
    await expect(page.getByRole("button", { name: pendingLabel, exact: true })).toBeDisabled();
    for (const cell of await rowRefreshCells.all()) {
      await expect(cell).toHaveAttribute("aria-busy", "true");
      await expectRowValues(cell, tab, false);
    }
    await api.finish(503);
    const idle = page.getByRole("button", { name: "Actualizar precios", exact: true });
    await expect(idle).toBeEnabled();
    await expect(idle).toHaveAttribute("aria-busy", "false");
    for (const cell of await rowRefreshCells.all()) {
      await expect(cell).toHaveAttribute("aria-busy", "false");
      await expectRowValues(cell, tab, true);
    }
  });
}
