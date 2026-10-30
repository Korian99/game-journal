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

test("appearance settings apply and persist both notebook palettes", async ({
  page,
}) => {
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=settings");

  const lightButton = page.getByRole("button", { name: "Claro", exact: true });
  const darkButton = page.getByRole("button", { name: "Oscuro", exact: true });
  const shell = page.locator(".app-shell.notebook-app");
  await expect(lightButton).toBeVisible();
  await lightButton.click();
  await expect(lightButton).toHaveAttribute("aria-pressed", "true");
  await expect(shell).toHaveCSS("--bg", "#ede5d8");
  await expect(shell).toHaveCSS("--surface", "#f5eee3");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(237, 229, 216)",
  );
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-settings-light-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-settings-preview.png"),
    fullPage: false,
    animations: "disabled",
  });
  expect(await page.evaluate(() => localStorage.getItem("journal-theme"))).toBe(
    "light",
  );

  await page.reload();
  await expect(lightButton).toHaveAttribute("aria-pressed", "true");
  await page.goto("./?tab=library");
  await expect(shell).toHaveCSS("--bg", "#ede5d8");
  await page.locator(".notebook-library-add").click();
  const editor = page.locator(".modal-content");
  await expect(editor).toHaveCSS("--surface", "#f5eee3");
  await expect(editor).toHaveCSS("color", "rgb(51, 42, 33)");
  await page.keyboard.press("Escape");
  await page.goto("./?tab=settings");

  await darkButton.click();
  await expect(darkButton).toHaveAttribute("aria-pressed", "true");
  await expect(shell).toHaveCSS("--bg", "#222326");
  await expect(shell).toHaveCSS("--surface", "#2b2c30");
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-settings-dark-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(await page.evaluate(() => localStorage.getItem("journal-theme"))).toBe(
    "dark",
  );

  for (const [theme, button] of [
    ["dark", darkButton],
    ["light", lightButton],
  ] as const) {
    await button.click();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390) {
        await page.screenshot({
          path: join(tmpdir(), `notebook-theme-settings-${theme}-390.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
});

test("yearly library summary stays readable across themes and viewports", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("journal-theme", "dark"));
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");

  const shell = page.locator(".app-shell.notebook-app");
  const disclosure = page.locator(".notebook-library-summary");
  const summary = disclosure.locator(".collection-summary");
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveJSProperty("open", true);
  await expect(summary.locator('[data-stat="total"] strong')).toHaveText("2");
  await expect(
    summary.getByRole("heading", { name: "Juegos por consola" }),
  ).toBeVisible();
  await disclosure.screenshot({
    path: join(tmpdir(), "notebook-year-summary-dark-desktop.png"),
    animations: "disabled",
  });

  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveJSProperty("open", false);
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveJSProperty("open", true);

  for (const width of [1280, 640, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const statRows = await summary
      .locator(".filtered-stats > div")
      .evaluateAll((elements) =>
        elements.slice(0, 3).map((element) => {
          const { x, y } = element.getBoundingClientRect();
          return { x, y };
        }),
      );
    expect(statRows[0]?.y).toBe(statRows[1]?.y);
    if (width > 600) expect(statRows[1]?.y).toBe(statRows[2]?.y);
    else expect(statRows[2]?.y).toBeGreaterThan(statRows[1]?.y ?? 0);
    const dimensions = await summary.evaluate((element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.page).toBeLessThanOrEqual(width);
    if (width === 390 || width === 360)
      await disclosure.screenshot({
        path: join(tmpdir(), `notebook-year-summary-dark-${width}.png`),
        animations: "disabled",
      });
  }

  await page.evaluate(() => {
    document.documentElement.classList.add("light");
    localStorage.setItem("journal-theme", "light");
  });
  await expect(shell).toHaveCSS("--bg", "#ede5d8");
  await page.setViewportSize({ width: 1280, height: 900 });
  await disclosure.screenshot({
    path: join(tmpdir(), "notebook-year-summary-light-desktop.png"),
    animations: "disabled",
  });

  for (const width of [1280, 640, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const statRows = await summary
      .locator(".filtered-stats > div")
      .evaluateAll((elements) =>
        elements.slice(0, 3).map((element) => {
          const { x, y } = element.getBoundingClientRect();
          return { x, y };
        }),
      );
    expect(statRows[0]?.y).toBe(statRows[1]?.y);
    if (width > 600) expect(statRows[1]?.y).toBe(statRows[2]?.y);
    else expect(statRows[2]?.y).toBeGreaterThan(statRows[1]?.y ?? 0);
    const dimensions = await summary.evaluate((element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.page).toBeLessThanOrEqual(width);
    if (width === 390 || width === 360)
      await disclosure.screenshot({
        path: join(tmpdir(), `notebook-year-summary-light-${width}.png`),
        animations: "disabled",
      });
  }
});

test("playing row highlight is blue only in light mode", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("journal-theme", "light"),
  );
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");

  const shell = page.locator(".app-shell.notebook-app");
  const row = page.locator(".library-table .library-playing");
  const rowStripe = row.locator("td:first-child");
  const completed = page
    .locator(".library-table tbody tr")
    .filter({ hasText: "Theme fixture" });
  await expect(shell).toHaveCSS("--accent", "#a46b32");
  await expect(shell).toHaveCSS("--collection-highlight", "#326ba4");
  await page.locator(".notebook-library-add").click();
  await expect(page.locator(".modal-content")).toHaveCSS("--accent", "#a46b32");
  await page.keyboard.press("Escape");

  const lightRowStyles = await row.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor };
  });
  expect(
    await rowStripe.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toContain("50, 107, 164");
  expect(lightRowStyles.background).not.toBe(
    await shell.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
  const completedShadow = await completed.evaluate(
    (element) =>
      getComputedStyle(element.querySelector("td:first-child")!).boxShadow,
  );
  expect(completedShadow).not.toContain("50, 107, 164");
  await row.screenshot({
    path: join(tmpdir(), "notebook-playing-highlight-light-row.png"),
    animations: "disabled",
  });
  await page.screenshot({
    path: join(tmpdir(), "notebook-playing-highlight-light-library.png"),
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileRow = page.locator(
    ".notebook-entry-card.library-playing:not(.notification-highlight)",
  );
  await expect(mobileRow).toBeVisible();
  expect(
    await mobileRow.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toContain("50, 107, 164");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await mobileRow.screenshot({
    path: join(tmpdir(), "notebook-playing-highlight-light-390.png"),
    animations: "disabled",
  });

  await page.evaluate(() => {
    document.documentElement.classList.remove("light");
    localStorage.setItem("journal-theme", "dark");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(shell).toHaveCSS("--accent", "#c4a25a");
  const darkShadow = await rowStripe.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(darkShadow).toContain("128, 183, 128");
  await page.setViewportSize({ width: 390, height: 844 });
  const darkMobileShadow = await mobileRow.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(darkMobileShadow).not.toContain("50, 107, 164");
});

test("discounted wishlist and released upcoming highlights follow the light theme", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("journal-theme", "light"),
  );
  await mockApp(page);

  const wishlist = {
    ...emptyRecord,
    id: "21000000-0000-4000-8000-000000000001",
    gameId: "31000000-0000-4000-8000-000000000001",
    title: "Discount fixture",
    status: "wishlist",
    device: "PC",
    updated_at: "2026-10-20T10:00:00Z",
  };
  const upcoming = {
    ...emptyRecord,
    id: "21000000-0000-4000-8000-000000000002",
    gameId: "31000000-0000-4000-8000-000000000002",
    title: "Released fixture",
    status: "upcoming",
    release: "2026-01-01",
    device: "Nintendo Switch",
    updated_at: "2026-10-19T10:00:00Z",
  };

  await page.route("**/api/records?*", (route) =>
    route.fulfill({
      json: {
        records: [wishlist, upcoming],
        member: { display_name: "Fixture", role: "member" },
      },
    }),
  );
  await page.route("**/api/offers", (route) =>
    route.fulfill({
      json: [
        {
          id: "offer-highlight-fixture",
          game_id: wishlist.gameId,
          url: "https://store.example.test/discount-fixture",
          store: "Fixture Store",
          region: "US",
          currency: "USD",
          price: 5,
          regular_price: 10,
          discount: 50,
          status: "available",
          checked_at: "2026-10-20T10:00:00Z",
          error: null,
          watched: true,
          target_price: null,
        },
      ],
    }),
  );

  const shell = page.locator(".app-shell.notebook-app");
  for (const [view, desktopSelector, mobileSelector] of [
    [
      "wishlist",
      "tbody tr.wishlist-discounted",
      ".mobile-game.wishlist-discounted",
    ],
    [
      "upcoming",
      "tbody tr.upcoming-released",
      ".mobile-game.upcoming-released",
    ],
  ] as const) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`./?tab=${view}`);
    await expect(shell).toHaveCSS("--accent", "#a46b32");
    await expect(shell).toHaveCSS("--collection-highlight", "#326ba4");
    const row = page.locator(desktopSelector).filter({ hasText: "fixture" });
    const stripe = row.locator("td:first-child");
    await expect(row).toBeVisible();
    expect(
      await stripe.evaluate((element) => getComputedStyle(element).boxShadow),
    ).toContain("50, 107, 164");
    const defaultBackground = await row.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await row.hover();
    const hoverBackground = await row.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(hoverBackground).not.toBe(defaultBackground);
    await row.screenshot({
      path: join(tmpdir(), `notebook-${view}-highlight-light-row.png`),
      animations: "disabled",
    });
    await page.screenshot({
      path: join(tmpdir(), `notebook-${view}-highlight-light-library.png`),
      animations: "disabled",
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRow = page.locator(mobileSelector).filter({
      hasText: "fixture",
    });
    await expect(mobileRow).toBeVisible();
    expect(
      await mobileRow.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      ),
    ).toContain("50, 107, 164");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await mobileRow.screenshot({
      path: join(tmpdir(), `notebook-${view}-highlight-light-390.png`),
      animations: "disabled",
    });

    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      localStorage.setItem("journal-theme", "dark");
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(shell).toHaveCSS("--accent", "#c4a25a");
    expect(
      await stripe.evaluate((element) => getComputedStyle(element).boxShadow),
    ).toContain("128, 183, 128");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await mobileRow.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      ),
    ).toContain("128, 183, 128");
  }
});

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
    if (pathname === "/api/notification-settings")
      return route.fulfill({
        json: { discounts: true, targets: true, releases: true },
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
