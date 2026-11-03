import { expect, test, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyRecord } from "../../src/lib/types";

const desktopScreenshot = join(tmpdir(), "notebook-library-desktop.png");
const mobileScreenshot = join(tmpdir(), "notebook-library-mobile.png");
const mobileContentScreenshot = join(
  tmpdir(),
  "notebook-library-mobile-content.png",
);
const narrowMobileScreenshot = join(
  tmpdir(),
  "notebook-library-mobile-360.png",
);
const filtersScreenshot = join(tmpdir(), "notebook-library-mobile-filters.png");
const toolbarScreenshot = join(tmpdir(), "notebook-library-toolbar.png");
const expandedScreenshot = join(
  tmpdir(),
  "notebook-library-mobile-expanded.png",
);

async function expectDesktopToolbarAligned(page: Page) {
  const searchBox = await page
    .locator(".notebook-library-search")
    .boundingBox();
  const filterBox = await page
    .locator(".notebook-library-filters > summary")
    .boundingBox();
  const sortBox = await page.locator(".notebook-library-sort").boundingBox();
  expect(searchBox).not.toBeNull();
  expect(filterBox).not.toBeNull();
  expect(sortBox).not.toBeNull();
  for (const [name, box] of [
    ["filters", filterBox!],
    ["sort", sortBox!],
  ] as const) {
    expect(
      Math.abs(searchBox!.y - box.y),
      `search and ${name} controls should share a top edge`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(searchBox!.height - box.height),
      `search and ${name} controls should have the same height`,
    ).toBeLessThanOrEqual(1);
  }
}

async function expectMobileToolbarAligned(page: Page, width: number) {
  const toolbarBox = await page
    .locator(".notebook-library-toolbar")
    .boundingBox();
  const searchBox = await page
    .locator(".notebook-library-search")
    .boundingBox();
  const filterBox = await page
    .locator(".notebook-library-filters > summary")
    .boundingBox();
  const sortBox = await page.locator(".notebook-library-sort").boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(filterBox).not.toBeNull();
  expect(sortBox).not.toBeNull();
  expect(Math.abs(searchBox!.x - toolbarBox!.x)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      searchBox!.x + searchBox!.width - (toolbarBox!.x + toolbarBox!.width),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(filterBox!.y - sortBox!.y),
    `mobile controls should align at ${width}px`,
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(filterBox!.height - sortBox!.height)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(filterBox!.height - 44),
    `mobile controls should be 44px tall at ${width}px`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(filterBox!.y - (searchBox!.y + searchBox!.height) - 8),
    `mobile toolbar should keep its 8px row gap at ${width}px`,
  ).toBeLessThanOrEqual(1);
}

test("the library keeps its filters and editor in a responsive notebook layout", async ({
  page,
}) => {
  const records = [
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000001",
      title: "The Last Route Through the Forgotten Kingdom",
      status: "completed",
      device: "Nintendo Switch",
      started: "2026-10-01",
      finished: "2026-10-16",
      hours: 47,
      estimated: "55",
      reason: "The ending made the long journey worth it.",
      impression: "A warm story with a memorable final chapter.",
      notes:
        "Red XIII made me cry. The narrative is warm, the cast is memorable, and the materia system kept every fight interesting.",
      rating: 92,
      cover: {
        provider: "steam",
        providerUrl:
          "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
      },
      updated_at: "2026-10-21T10:00:00Z",
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000002",
      title: "Filtered out",
      status: "playing",
      device: "Steam Deck",
      started: "2026-10-02",
      updated_at: "2026-10-20T10:00:00Z",
    },
  ];

  await page.route("https://shared.akamai.steamstatic.com/**", (route) =>
    route.abort(),
  );
  await page.route("https://assets.nintendo.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#82a8ff"/></svg>',
    }),
  );
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/records")
      return route.fulfill({
        json: {
          records,
          member: {
            id: "10000000-0000-4000-8000-000000000001",
            display_name: "Fixture",
            role: "member",
          },
        },
      });
    if (pathname === "/api/offers") return route.fulfill({ json: [] });
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
    if (pathname === "/api/backups") {
      const checkedAt = new Date().toISOString();
      const lastSuccess = {
        id: "backup-fixture",
        status: "succeeded",
        completed_at: checkedAt,
      };
      return route.fulfill({
        json: { checkedAt, lastSuccess, latest: lastSuccess },
      });
    }
    return route.fulfill({ json: [] });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library&year=all");
  await expectDesktopToolbarAligned(page);
  await expect(page.locator(".app-shell.notebook-library")).toBeVisible();
  await expect(page.locator(".app-shell.notebook-library")).toHaveCSS(
    "--bg",
    "#222326",
  );
  await expect(page.locator(".journal-desktop-table")).toBeVisible();
  await expect(page.locator(".notebook-library .sidebar")).toHaveCSS(
    "position",
    "fixed",
  );
  await expect(page.locator(".notebook-library .sidebar")).toHaveCSS(
    "width",
    "236px",
  );
  await expect(
    page.locator(".notebook-library .sidebar nav button"),
  ).toHaveCount(8);
  await page.screenshot({
    path: desktopScreenshot,
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".notebook-library-toolbar").screenshot({
    path: toolbarScreenshot,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 980, height: 900 });
  await expectDesktopToolbarAligned(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  const filterDisclosure = page.locator(".notebook-library-filters > summary");
  await expect(page.locator(".notebook-library-kicker")).toContainText(
    "Todos los años",
  );
  await expect(filterDisclosure.locator(".notebook-filter-count")).toHaveText(
    "0",
  );
  await expect(page.getByLabel("Filtrar estado")).not.toBeVisible();
  await filterDisclosure.click();
  await expect(page.getByLabel("Filtrar estado")).toBeVisible();
  await page.getByLabel("Ordenar Biblioteca").selectOption("title.desc");
  await expect(
    page.locator(".library-table tbody tr.game-data-row").first(),
  ).toContainText("The Last Route Through the Forgotten Kingdom");
  await page.getByLabel("Filtrar estado").selectOption("completed");
  await expect(filterDisclosure.locator(".notebook-filter-count")).toHaveText(
    "1",
  );
  await expect(
    page
      .locator(".library-table")
      .getByText("The Last Route Through the Forgotten Kingdom", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(
    page.locator(".library-table").getByText("Filtered out", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Vista de portadas", exact: true })
    .click();
  await expect(page.locator(".library-cover-grid")).toHaveCount(1);
  await expect(
    page
      .locator(".library-cover-grid")
      .getByText("Filtered out", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/cover-grid-desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("img", {
      name: "Sin portada de The Last Route Through the Forgotten Kingdom",
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Editar The Last Route Through the Forgotten Kingdom",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Vista de tabla", exact: true })
    .click();
  await filterDisclosure.click();
  await page
    .getByRole("button", {
      name: "Ver detalles de The Last Route Through the Forgotten Kingdom",
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "test-results/cover-editor-desktop.png", fullPage: true });
  await page
    .getByLabel("URL de portada", { exact: true })
    .fill("https://assets.nintendo.com/image/upload/recovery.jpg");
  await expect(page.locator(".cover-editor img")).toHaveAttribute(
    "src",
    "https://assets.nintendo.com/image/upload/recovery.jpg",
  );
  await expect(page.locator(".cover-editor img")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Descartar cambios" })).toBeVisible();
  await page.getByRole("button", { name: "Descartar cambios", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("./?tab=library&year=all&sort=rating.desc%2Cimpression.asc");
  await expect(page.getByLabel("Ordenar Biblioteca")).toHaveValue("custom");
  await expect(
    page.getByLabel("Ordenar Biblioteca").locator("option:checked"),
  ).toContainText("criterio combinado");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?tab=library&year=all");
  await expectMobileToolbarAligned(page, 390);
  const mobileFilters = page.locator(".notebook-library-filters > summary");
  await mobileFilters.click();
  await page.getByLabel("Filtrar estado").selectOption("");
  await mobileFilters.click();
  const librarySearch = page.getByLabel("Buscar juegos en esta lista");
  await librarySearch.fill("Route");
  await expect(page.locator(".notebook-entry-card")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Route");
  await page.reload();
  await expect(librarySearch).toHaveValue("Route");
  await expect(page.locator(".notebook-entry-card")).toHaveCount(1);
  await librarySearch.fill("");
  await librarySearch.evaluate((input) => input.blur());
  await expect(page.locator(".notebook-entry-card")).toHaveCount(2);
  await expect(page.locator(".mobile-games")).toBeVisible();
  await page
    .getByRole("button", { name: "Vista de portadas", exact: true })
    .click();
  await expect(page.locator(".library-cover-card")).toHaveCount(2);
  await page.screenshot({ path: "test-results/cover-grid-mobile.png", fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add("light"));
  await page.screenshot({ path: "test-results/cover-grid-mobile-light.png", fullPage: true });
  await page.evaluate(() => document.documentElement.classList.remove("light"));
  await page
    .getByRole("button", { name: "Vista de tabla", exact: true })
    .click();
  await expect(
    page.locator(".notebook-entry-card .review-mark").first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".notebook-entry-card")
      .nth(1)
      .getByText("Leer comentarios"),
  ).toBeVisible();
  await expect(
    page
      .locator(".notebook-entry-card")
      .nth(1)
      .getByText("The ending made the long journey worth it.", { exact: true }),
  ).not.toBeVisible();
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await expectMobileToolbarAligned(page, width);
    const firstCard = page.locator(".notebook-entry-card").first();
    await expect(firstCard.getByRole("heading")).toHaveCSS("font-size", "20px");
    await expect(firstCard.locator(".review-mark")).toBeVisible();
    expect(
      await firstCard.evaluate((node) => node.getBoundingClientRect().top),
    ).toBeLessThan(390);
    if (width === 390)
      await page.screenshot({ path: mobileScreenshot, animations: "disabled" });
    await expect(
      page.locator(".notebook-library .notebook-bottom-nav button"),
    ).toHaveCount(4);
    for (const label of ["Biblioteca", "Diario", "Deseos", "Más"])
      await expect(
        page
          .locator(".notebook-library .notebook-bottom-nav")
          .getByRole("button", { name: label }),
      ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width === 360) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: narrowMobileScreenshot,
        animations: "disabled",
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const activeFilters = page.locator(".notebook-library-filters > summary");
  await activeFilters.click();
  await expect(page.getByLabel("Filtrar estado")).toBeVisible();
  await page.getByLabel("Filtrar estado").selectOption("completed");
  await expect(page.locator(".notebook-entry-card")).toHaveCount(1);
  await page.getByLabel("Filtrar estado").selectOption("");
  await expect(page.locator(".notebook-entry-card")).toHaveCount(2);
  await page.screenshot({
    path: filtersScreenshot,
    animations: "disabled",
  });
  await activeFilters.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: mobileScreenshot,
    animations: "disabled",
  });
  const detailedCard = page.locator(".notebook-entry-card").nth(1);
  await detailedCard.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: mobileContentScreenshot,
    animations: "disabled",
  });
  await detailedCard.getByText("Leer comentarios").click();
  await expect(
    detailedCard.getByText("The ending made the long journey worth it."),
  ).toBeVisible();
  await expect(
    detailedCard.getByText("A warm story with a memorable final chapter."),
  ).toBeVisible();
  await expect(detailedCard.getByText(/Red XIII made me cry/)).toBeVisible();
  await page.locator(".notebook-entry-reflections[open]").evaluate((node) => {
    const top = node.getBoundingClientRect().top;
    window.scrollBy(0, top - 150);
  });
  await page.screenshot({ path: expandedScreenshot, animations: "disabled" });
  await detailedCard.getByText("Ocultar comentarios").click();
  await expect(
    detailedCard.getByText("The ending made the long journey worth it."),
  ).not.toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));

  await page
    .locator(".notebook-bottom-nav")
    .getByRole("button", { name: "Más" })
    .click();
  await expect(page.locator(".sidebar.open")).toBeVisible();
  await expect(page.locator(".sidebar.open nav button")).toHaveCount(8);
  await expect(
    page.locator(".notebook-bottom-nav").getByRole("button", { name: "Más" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page
      .locator(".sidebar.open")
      .getByRole("button", { name: "Configuración" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".sidebar.open")
      .getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
  await expect(
    page.locator(".sidebar.open").getByRole("button", { name: "Cerrar menú" }),
  ).toBeVisible();
  await page.locator(".notebook-menu-scrim").click({
    position: { x: 350, y: 400 },
  });
  await expect(page.locator(".sidebar.open")).toHaveCount(0);
  await page
    .locator(".notebook-bottom-nav")
    .getByRole("button", { name: "Más" })
    .click();
  await page
    .locator(".sidebar.open")
    .getByRole("button", { name: "Próximos" })
    .click();
  await expect(page.getByRole("heading", { name: "Próximos." })).toBeVisible();
  await page
    .locator(".notebook-bottom-nav")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await page
    .locator(".sidebar.open")
    .getByRole("button", { name: "Biblioteca" })
    .click();
  await expect(page.locator(".app-shell.notebook-library")).toBeVisible();
  await page.locator(".notebook-library-filters > summary").click();
  await page.getByLabel("Filtrar estado").selectOption("completed");
  await page
    .getByRole("button", {
      name: "Editar rápidamente The Last Route Through the Forgotten Kingdom",
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("row artwork appears in every collection view and missing or failed art stays empty", async ({
  page,
}) => {
  const records = [
    {
      ...emptyRecord,
      id: "art-library",
      gameId: "game-library",
      title: "Library art",
      status: "completed",
      finished: "2026-10-01",
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/library.jpg",
      },
    },
    {
      ...emptyRecord,
      id: "art-journal",
      gameId: "game-journal",
      title: "Journal art",
      status: "playing",
      started: "2026-10-01",
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/journal.jpg",
      },
    },
    {
      ...emptyRecord,
      id: "art-wishlist",
      gameId: "game-wishlist",
      title: "Wishlist art",
      status: "wishlist",
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/wishlist.jpg",
      },
    },
    {
      ...emptyRecord,
      id: "art-upcoming",
      gameId: "game-upcoming",
      title: "Upcoming art",
      status: "upcoming",
      release: "2099-10-01",
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/upcoming.jpg",
      },
    },
    {
      ...emptyRecord,
      id: "art-missing",
      gameId: "game-missing",
      title: "No art",
      status: "completed",
      finished: "2026-10-01",
    },
    {
      ...emptyRecord,
      id: "art-failed",
      gameId: "game-failed",
      title: "Failed art",
      status: "completed",
      finished: "2026-10-02",
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/fail.jpg",
      },
    },
  ];
  await page.route("https://assets.nintendo.com/**", (route) =>
    route.request().url().includes("fail.jpg")
      ? route.abort()
      : route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320"><defs><linearGradient id="g"><stop stop-color="#242b54"/><stop offset="1" stop-color="#df785b"/></linearGradient></defs><rect width="480" height="320" fill="url(#g)"/><circle cx="360" cy="92" r="66" fill="#f5d77b"/><path d="M0 270 145 120l100 110 85-84 150 174H0Z" fill="#293b47"/><path d="m0 300 125-92 86 62 90-106 179 156H0Z" fill="#1c2831" opacity=".8"/></svg>`,
        }),
  );
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/records")
      return route.fulfill({
        json: {
          records,
          member: { id: "fixture", display_name: "Fixture", role: "member" },
        },
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
    return route.fulfill({ json: [] });
  });

  for (const [view, title] of [
    ["library", "Library art"],
    ["journal", "Journal art"],
    ["wishlist", "Wishlist art"],
    ["upcoming", "Upcoming art"],
  ] as const) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`./?tab=${view}&year=all`);
    const row = page
      .locator(".journal-desktop-table tr.game-data-row")
      .filter({ hasText: title });
    await expect(row.locator(".game-row-art img")).toBeVisible();
    await expect(row.locator(".game-row-art img")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
    await expect(row.locator(".game-row-art img")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
    const rowBounds = await row.boundingBox();
    const artBounds = await row.locator(".game-row-art-wide").boundingBox();
    expect(rowBounds).not.toBeNull();
    expect(artBounds).not.toBeNull();
    expect(
      Math.abs(
        artBounds!.x + artBounds!.width - (rowBounds!.x + rowBounds!.width),
      ),
    ).toBeLessThanOrEqual(1);
    if (view === "library")
      await page.screenshot({
        path: "test-results/artwork-full-row-desktop.png",
        fullPage: true,
        animations: "disabled",
      });
    await row.screenshot({
      path: `test-results/artwork-row-${view}-dark-desktop.png`,
    });
    await page.evaluate(() => document.documentElement.classList.add("light"));
    await row.screenshot({
      path: `test-results/artwork-row-${view}-light-desktop.png`,
    });
    await page.evaluate(() =>
      document.documentElement.classList.remove("light"),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRow = page
      .locator(
        view === "library"
          ? ".notebook-entry-card"
          : ".mobile-game-wrapper > .mobile-game",
      )
      .filter({ hasText: title });
    await expect(mobileRow.locator(".game-row-art img")).toBeVisible();
    if (view === "library")
      await page.screenshot({
        path: "test-results/artwork-full-row-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
    await mobileRow.screenshot({
      path: `test-results/artwork-row-${view}-dark-mobile.png`,
    });
    await page.evaluate(() => document.documentElement.classList.add("light"));
    await mobileRow.screenshot({
      path: `test-results/artwork-row-${view}-light-mobile.png`,
    });
    await page.evaluate(() =>
      document.documentElement.classList.remove("light"),
    );
  }
  await page.goto("./?tab=library&year=all");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(
    page
      .locator(".game-data-row")
      .filter({ hasText: "No art" })
      .locator(".game-row-art"),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".game-data-row")
      .filter({ hasText: "Failed art" })
      .locator(".game-row-art"),
  ).toHaveCount(0);
  await page
    .locator(".game-data-row")
    .filter({ hasText: "No art" })
    .getByRole("button", { name: "Ver detalles de No art" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("No art");
});
