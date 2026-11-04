import { expect, test } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
import { openFullGame } from "./open-full-game";

test("production scale filters real entries and survives reload and reset on desktop and mobile", async ({ page }) => {
  const records = ["indie", "aa", "aaa", null].map((scale, index) => ({
    ...emptyRecord,
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    gameId: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Scale game ${index + 1}`,
    status: "playing",
    period: "2026",
    scale,
  }));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === "/api/records" ? { records, member: { display_name: "Fixture", role: "member" } } : path === "/api/notifications" ? { items: [], unreadCount: 0, nextCursor: null, checkedAt: new Date().toISOString() } : path === "/api/sharing" ? { shared: [], members: [], grants: [] } : path === "/api/backups" ? { checkedAt: new Date().toISOString(), latest: null, lastSuccess: null } : [] });
  });

  await page.goto("./?tab=library&year=all");
  const table = page.locator("table");
  const filter = page.getByLabel("Filtrar escala", { exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await page.locator(".notebook-library-filters > summary").click();
  await filter.selectOption("aa");
  await expect(page).toHaveURL(/scale=aa/);
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.getByText("Scale game 2", { exact: true })).toBeVisible();
  await page.reload();
  await page.locator(".notebook-library-filters > summary").click();
  await expect(filter).toHaveValue("aa");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await filter.selectOption("");
  await expect(page).not.toHaveURL(/scale=/);
  await expect(page.locator(".notebook-entry-list .notebook-entry-card")).toHaveCount(4);
});

test("journal filter labels and controls fit the desktop and mobile panels", async ({ page }) => {
  const records = [
    { ...emptyRecord, id: "20000000-0000-4000-8000-000000000021", gameId: "30000000-0000-4000-8000-000000000021", title: "Filter layout fixture", status: "playing", period: "2026", platforms: "Nintendo Switch OLED", scale: "indie" },
  ];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === "/api/records" ? { records, member: { display_name: "Fixture", role: "member" } } : path === "/api/notifications" ? { items: [], unreadCount: 0, nextCursor: null, checkedAt: new Date().toISOString() } : path === "/api/sharing" ? { shared: [], members: [], grants: [] } : path === "/api/backups" ? { checkedAt: new Date().toISOString(), latest: null, lastSuccess: null } : [] });
  });
  await page.goto("./?tab=journal&year=all");
  await page.locator(".notebook-view-filters > summary").click();
  const panel = page.locator(".notebook-view-filter-panel");
  for (const name of ["Año", "Estado", "Reseña", "Plataforma", "Escala"])
    await expect(panel.locator("label").filter({ hasText: name })).toBeVisible();
  const geometry = async () => panel.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
    selectHeights: [...element.querySelectorAll("select")].map((item) => Math.round(item.getBoundingClientRect().height)),
    platformWidth: element.querySelector<HTMLSelectElement>('[aria-label="Filtrar plataforma"]')!.getBoundingClientRect().width,
    yearWidth: element.querySelector<HTMLSelectElement>(".year-filter select")!.getBoundingClientRect().width,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
  }));
  const desktop = await geometry();
  expect(desktop.columns).toBe(2);
  expect(desktop.selectHeights.every((height) => height === 44)).toBe(true);
  expect(desktop.platformWidth).toBeGreaterThan(200);
  await page.screenshot({ path: "test-results/scale-filter-panel-desktop.png" });
  for (const width of [641, 640, 761, 800, 900, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/filter-popup-${width}.png` });
    const box = await geometry();
    expect(box.left, `filter panel left at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(box.right, `filter panel right at ${width}px`).toBeLessThanOrEqual(width);
    await expect(panel.getByLabel("Filtrar escala", { exact: true })).toBeVisible();
  }
  const optionColors = () => page.locator(".notebook-view-sort select option").first().evaluate((option) => {
    const style = getComputedStyle(option);
    return [style.color, style.backgroundColor];
  });
  const contrast = (colors: string[]) => {
    const luminance = (color: string) => {
      const values = color.match(/\d+/g)!.slice(0, 3).map(Number).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    const [text, background] = colors.map(luminance).sort((a, b) => b - a);
    return (text + 0.05) / (background + 0.05);
  };
  const darkColors = await optionColors();
  expect(darkColors[1]).not.toMatch(/^rgba\([^)]*,\s*0(?:\.0+)?\)$/);
  expect(contrast(darkColors)).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => document.documentElement.classList.add("light"));
  const lightColors = await optionColors();
  expect(lightColors[1]).not.toMatch(/^rgba\([^)]*,\s*0(?:\.0+)?\)$/);
  expect(contrast(lightColors)).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => document.documentElement.classList.remove("light"));
  for (const view of ["wishlist", "upcoming"]) {
    await page.goto(`./?tab=${view}`);
    await page.locator(".notebook-view-filters > summary").click();
    const viewPanel = page.locator(".notebook-view-filter-panel");
    for (const width of [641, 640, 761, 800, 900, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      const bounds = await viewPanel.boundingBox();
      expect(bounds!.x, `${view} popup left at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, `${view} popup right at ${width}px`).toBeLessThanOrEqual(width);
    }
    expect(contrast(await optionColors())).toBeGreaterThanOrEqual(4.5);
  }
  await page.goto("./?tab=library&year=all");
  await page.locator(".notebook-library-filters > summary").click();
  await page.setViewportSize({ width: 761, height: 900 });
  await page.screenshot({ path: "test-results/library-filter-popup-761.png" });
  const libraryPanel = await page.locator(".notebook-filter-panel").boundingBox();
  expect(libraryPanel!.x).toBeGreaterThanOrEqual(0);
  expect(libraryPanel!.x + libraryPanel!.width).toBeLessThanOrEqual(761);
  await page.goto("./?tab=journal&year=all");
  await page.locator(".notebook-view-filters > summary").click();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await geometry();
  expect(mobile.columns).toBe(1);
  expect(mobile.selectHeights.every((height) => height === 44)).toBe(true);
  expect(mobile.yearWidth).toBe(mobile.platformWidth);
  expect(mobile.right).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/scale-filter-panel-mobile.png", fullPage: true });
  await panel.screenshot({ path: "test-results/scale-filter-controls-mobile.png" });
});

for (const mobile of [false, true]) {
  test(`editor saves, reloads, and clears game scale (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const initial = {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000001",
      gameId: "30000000-0000-4000-8000-000000000001",
      title: "Scale editor fixture",
      status: "wishlist",
      updated_at: "2026-11-04T10:00:00Z",
    };
    let record = initial;
    const posts: Record<string, unknown>[] = [];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/records" && route.request().method() === "POST") {
        const input = route.request().postDataJSON() as Record<string, unknown>;
        posts.push(input);
        record = { ...record, ...input, updated_at: `2026-11-04T10:0${posts.length}:00Z` };
        return route.fulfill({ json: { id: record.id, gameId: record.gameId, record } });
      }
      return route.fulfill({ json: path === "/api/records" ? { records: [record], member: { display_name: "Fixture", role: "member" } } : path === "/api/notifications" ? { items: [], unreadCount: 0, nextCursor: null, checkedAt: new Date().toISOString() } : path === "/api/sharing" ? { shared: [], members: [], grants: [] } : path === "/api/backups" ? { checkedAt: new Date().toISOString(), latest: null, lastSuccess: null } : [] });
    });
    await page.goto("./?tab=wishlist");
    const open = () => openFullGame(page, initial.title);
    await open();
    let dialog = page.getByRole("dialog", { name: "Tu partida" });
    await dialog.getByRole("tab", { name: "Más" }).click();
    const scale = dialog.getByLabel("Escala de producción", { exact: true });
    await scale.selectOption("aa");
    await dialog.getByRole("button", { name: "Guardar entrada", exact: true }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].scale).toBe("aa");
    await expect(dialog).toHaveCount(0);
    await open();
    dialog = page.getByRole("dialog", { name: "Tu partida" });
    await dialog.getByRole("tab", { name: "Más" }).click();
    await expect(dialog.getByLabel("Escala de producción", { exact: true })).toHaveValue("aa");
    await dialog.getByLabel("Escala de producción", { exact: true }).selectOption("");
    await dialog.getByRole("button", { name: "Guardar entrada", exact: true }).click();
    await expect.poll(() => posts.length).toBe(2);
    expect(posts[1].scale).toBeNull();
    await expect(dialog).toHaveCount(0);
    await open();
    dialog = page.getByRole("dialog", { name: "Tu partida" });
    await dialog.getByRole("tab", { name: "Más" }).click();
    await expect(dialog.getByLabel("Escala de producción", { exact: true })).toHaveValue("");
  });
}
