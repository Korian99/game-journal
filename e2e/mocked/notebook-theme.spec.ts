import { expect, test, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyRecord } from "../../src/lib/types";

const views = [
  ["library", "Biblioteca"],
  ["journal", "Diario"],
  ["wishlist", "Lista de deseos"],
  ["upcoming", "Próximos"],
  ["suggestions", "¿Qué juego ahora?"],
  ["statistics", "Estadísticas"],
  ["shared", "Compartido conmigo"],
  ["settings", "Configuración"],
] as const;

async function mockApp(page: Page) {
  const records = [
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000001",
      gameId: "30000000-0000-4000-8000-000000000001",
      title: "Theme fixture",
      status: "completed",
      period: "2026",
      started: "2026-01-02",
      finished: "2026-01-10",
      device: "PC",
      hours: 12,
      rating: 84,
      updated_at: "2026-10-20T10:00:00Z",
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000002",
      gameId: "30000000-0000-4000-8000-000000000002",
      title: "Wishlist fixture",
      status: "wishlist",
      device: "Steam Deck",
      updated_at: "2026-10-19T10:00:00Z",
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000003",
      gameId: "30000000-0000-4000-8000-000000000003",
      title: "Playing fixture",
      status: "playing",
      device: "Nintendo Switch",
      started: "2026-10-01",
      hours: 5,
      updated_at: "2026-10-18T10:00:00Z",
    },
  ];

  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/records")
      return route.fulfill({
        json: { records, member: { display_name: "Fixture", role: "member" } },
      });
    if (pathname === "/api/notifications")
      return route.fulfill({
        json: {
          items: [],
          unreadCount: 0,
          nextCursor: null,
          checkedAt: new Date().toISOString(),
        },
      });
    if (pathname === "/api/sharing")
      return route.fulfill({ json: { shared: [], members: [], grants: [] } });
    if (pathname === "/api/backups/drive")
      return route.fulfill({
        json: {
          configured: false,
          connected: false,
          state: "disconnected",
          folderId: null,
          errorCode: null,
          recoveryVerifiedAt: null,
          latest: null,
          lastSuccess: null,
          checkedAt: new Date().toISOString(),
        },
      });
    if (pathname === "/api/backups")
      return route.fulfill({
        json: {
          checkedAt: new Date().toISOString(),
          latest: null,
          lastSuccess: null,
        },
      });
    return route.fulfill({ json: [] });
  });
}

test("the charcoal notebook theme and four-action navigation cover every tab", async ({
  page,
}) => {
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const [view, label] of views) {
    await page.goto(`./?tab=${view}`);
    const shell = page.locator(".app-shell.notebook-app");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveCSS("--bg", "#222326");
    await expect(shell).toHaveCSS("--surface", "#2b2c30");
    await expect(page.locator(".sidebar nav button.active")).toContainText(
      label,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(1280);
    await page.screenshot({
      path: join(tmpdir(), `notebook-theme-${view}-desktop.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [view] of views) {
      await page.goto(`./?tab=${view}`);
      await expect(
        page.locator(".notebook-app .notebook-bottom-nav button"),
      ).toHaveCount(4);
      const expectedCurrent =
        view === "library"
          ? "Biblioteca"
          : view === "journal"
            ? "Diario"
            : view === "wishlist"
              ? "Deseos"
              : "Más";
      await expect(
        page
          .locator(".notebook-bottom-nav")
          .getByRole("button", { name: expectedCurrent }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390) {
        await page.screenshot({
          path: join(tmpdir(), `notebook-theme-${view}-390.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }

  await page.goto("./?tab=statistics");
  await page
    .locator(".notebook-bottom-nav")
    .getByRole("button", { name: "Más" })
    .click();
  await expect(page.locator(".sidebar.open nav button")).toHaveCount(8);
  await expect(
    page.locator(".sidebar.open").getByRole("button", {
      name: "Cerrar sesión",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator(".sidebar.open")
    .getByRole("button", { name: "Configuración" })
    .click();
  await expect(page.locator(".sidebar.open")).toHaveCount(0);
  await expect(
    page.locator(".notebook-bottom-nav").getByRole("button", { name: "Más" }),
  ).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");
  await page.locator(".notebook-library-add").click();
  const editor = page.locator(".modal-content");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS("--surface", "#2b2c30");
  await expect(editor).toHaveCSS("color", "rgb(238, 234, 224)");
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-editor-portal.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("collection filters remain discoverable inside a compact disclosure", async ({
  page,
}) => {
  await mockApp(page);

  for (const width of [1280, 980]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./?tab=wishlist");
    const boxes = await page.evaluate(() => {
      const search = document
        .querySelector(".notebook-view-toolbar .search")!
        .getBoundingClientRect();
      const filters = document
        .querySelector(".notebook-view-filters > summary")!
        .getBoundingClientRect();
      const sort = document
        .querySelector(".notebook-view-sort")!
        .getBoundingClientRect();
      const refresh = document
        .querySelector(".notebook-view-toolbar-actions > .secondary")!
        .getBoundingClientRect();
      return [search, filters, sort, refresh].map(({ top, height }) => ({
        top,
        height,
      }));
    });
    for (const box of boxes.slice(1)) {
      expect(Math.abs(boxes[0].top - box.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[0].height - box.height)).toBeLessThanOrEqual(1);
    }
  }

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ["journal", "wishlist", "upcoming"] as const) {
      await page.goto(`./?tab=${view}`);
      await expect(
        page.getByLabel("Buscar juegos en esta lista", { exact: true }),
      ).toBeVisible();
      const filters = page.locator(".notebook-view-filters > summary");
      const sort = page.locator(".notebook-view-sort");
      await expect(filters).toBeVisible();
      await expect(sort).toBeVisible();
      const toolbar = page.locator(".notebook-view-toolbar");
      const search = toolbar.locator(".search");
      const searchBox = await search.boundingBox();
      const toolbarBox = await toolbar.boundingBox();
      expect(searchBox?.x).toBe(toolbarBox?.x);
      expect(searchBox?.width).toBe(toolbarBox?.width);
      await expect(page.getByLabel("Filtrar plataforma")).not.toBeVisible();
      if (view === "upcoming") {
        const refresh = page.getByRole("button", {
          name: "Actualizar precios",
        });
        await expect(refresh).toBeVisible();
        const [filterBox, sortBox, refreshBox] = await Promise.all([
          filters.boundingBox(),
          sort.boundingBox(),
          refresh.boundingBox(),
        ]);
        expect(filterBox?.height).toBe(refreshBox?.height);
        expect(filterBox?.height).toBe(sortBox?.height);
        expect(filterBox?.y).toBe(sortBox?.y);
        expect(refreshBox!.y).toBeGreaterThan(filterBox!.y);
      } else {
        const [filterBox, sortBox] = await Promise.all([
          filters.boundingBox(),
          sort.boundingBox(),
        ]);
        expect(filterBox?.height).toBe(sortBox?.height);
        expect(filterBox?.y).toBe(sortBox?.y);
      }
      await filters.click();
      await expect(page.getByLabel("Filtrar plataforma")).toBeVisible();
      if (view === "journal") {
        await page.getByLabel("Filtrar reseña").selectOption("with");
        expect(new URL(page.url()).searchParams.get("review")).toBe("with");
      } else if (view === "wishlist") {
        await page.getByLabel("Filtrar descuentos").selectOption("discounted");
        expect(new URL(page.url()).searchParams.get("discount")).toBe(
          "discounted",
        );
      }
    }
  }
});
