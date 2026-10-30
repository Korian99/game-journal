import { expect, test, type Page } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

const preview = {
  url: "https://store.steampowered.com/app/620/",
  store: "steam",
  region: "AR",
  checkedAt: "2026-10-22T12:00:00Z",
  fields: { title: "Portal 2", platforms: "PC", year: 2011 },
  quote: {
    name: "Portal 2",
    status: "available",
    price: 2,
    regular: 10,
    currency: "USD",
    discount: 80,
  },
};

type FixtureOptions = {
  search?: "results" | "empty" | "error";
  holdSearch?: boolean;
  holdPreview?: boolean;
  usPage?: boolean;
};

async function openEntry(page: Page, options: FixtureOptions = {}) {
  const saves: Record<string, unknown>[] = [];
  const searches: string[] = [];
  const providers: string[] = [];
  const searchReleases = new Map<string, () => void>();
  const previews: Record<string, unknown>[] = [];
  let releasePreview: (() => void) | undefined;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/store-search") {
      const term = url.searchParams.get("q") ?? "";
      const store = url.searchParams.get("store") ?? "steam";
      searches.push(term);
      providers.push(store);
      if (options.holdSearch)
        await new Promise<void>((resolve) =>
          searchReleases.set(`${store}:${term}`, resolve),
        );
      if (options.search === "error")
        return route.fulfill({
          status: 503,
          json: { error: "Steam no disponible.", code: "TEMPORARY" },
        });
      return route.fulfill({
        json: {
          results:
            options.search === "empty"
              ? []
              : store === "nintendo"
                ? [
                    {
                      store: "nintendo",
                      title: "The Legend of Zelda: Breath of the Wild",
                      id: "the-legend-of-zelda-breath-of-the-wild-switch",
                      url: "https://www.nintendo.com/es-ar/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
                      platform: "Switch",
                      cover: {
                        providerUrl:
                          "https://assets.nintendo.com/image/upload/the-legend-of-zelda.jpg",
                        provider: "nintendo",
                      },
                    },
                  ]
                : term === "half-life"
                  ? [
                      {
                        store: "steam",
                        title: "Half-Life",
                        id: "70",
                        url: "https://store.steampowered.com/app/70/",
                        cover: {
                          providerUrl:
                            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/70/capsule.jpg",
                          provider: "steam",
                        },
                      },
                    ]
                  : [
                      ...Array.from({ length: 8 }, (_, index) => ({
                        store: "steam",
                        title: `Portal Companion ${index + 1}`,
                        id: String(500 + index),
                        url: `https://store.steampowered.com/app/${500 + index}/`,
                        cover: {
                          providerUrl:
                            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/500/capsule.jpg",
                          provider: "steam",
                        },
                      })),
                      {
                        store: "steam",
                        title: "Portal 2",
                        id: "620",
                        url: "https://store.steampowered.com/app/620/",
                        cover: {
                          providerUrl:
                            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg",
                          provider: "steam",
                        },
                      },
                    ],
        },
      });
    }
    if (url.pathname === "/api/store-preview") {
      const input = route.request().postDataJSON();
      previews.push(input);
      if (options.holdPreview)
        await new Promise<void>((resolve) => {
          releasePreview = resolve;
        });
      try {
        return await route.fulfill({
          json: String(input.url).includes("nintendo.com")
            ? {
                ...preview,
                url: input.url,
                store: "nintendo",
                fields: {
                  title: "The Legend of Zelda: Breath of the Wild",
                  platforms: "Switch",
                  release: "2017-03-03",
                  year: 2017,
                },
                ...(options.usPage === false
                  ? {}
                  : {
                      additionalPages: [
                        "https://www.nintendo.com/us/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
                      ],
                    }),
                quote: {
                  name: "The Legend of Zelda: Breath of the Wild",
                  status: "available",
                  price: 90999,
                  regular: 90999,
                  currency: "ARS",
                  discount: 0,
                },
              }
            : preview,
        });
      } catch {
        return;
      }
    }
    if (url.pathname === "/api/records") {
      if (route.request().method() === "POST") {
        const input = route.request().postDataJSON();
        saves.push(input);
        const record = {
          ...emptyRecord,
          ...input,
          id: "20000000-0000-4000-8000-000000000001",
          gameId: "30000000-0000-4000-8000-000000000001",
        };
        return route.fulfill({
          json: { id: record.id, gameId: record.gameId, record },
        });
      }
      return route.fulfill({
        json: {
          records: [],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  await page.goto("./?tab=wishlist");
  await page
    .getByRole("button", { name: "Agregar juego", exact: true })
    .click();
  return {
    saves,
    searches,
    providers,
    previews,
    releasePreview: () => releasePreview?.(),
    releaseSearch: (store: string, term: string) =>
      searchReleases.get(`${store}:${term}`)?.(),
  };
}

test("Nintendo search saves the AR page when no US counterpart is verified", async ({
  page,
}) => {
  const { saves } = await openEntry(page, { usPage: false });
  await page.getByLabel("Tienda de búsqueda").selectOption("nintendo");
  await page.getByLabel("Buscar por título en Nintendo").fill("zelda");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: /The Legend of Zelda/ }).click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("The Legend of Zelda: Breath of the Wild");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({
    title: "The Legend of Zelda: Breath of the Wild",
    pages: [
      "https://www.nintendo.com/es-ar/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
    ],
  });
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`Steam title search adds a draft and requires explicit save on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const { saves, searches, previews } = await openEntry(page);
    await page.getByLabel("Buscar por título en Steam").fill("portal");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    const result = page.getByRole("button", { name: "Portal 2" });
    await expect(result).toBeVisible();
    await result.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/store-search-results-${viewport.name}.png`,
      fullPage: true,
    });
    await page.evaluate(() => document.documentElement.classList.add("light"));
    await page.screenshot({
      path: `test-results/store-search-results-${viewport.name}-light.png`,
      fullPage: true,
    });
    await page.evaluate(() =>
      document.documentElement.classList.remove("light"),
    );
    await result.click();
    await expect(
      page.getByLabel("Nombre del juego", { exact: true }),
    ).toHaveValue("Portal 2");
    await expect(
      page.getByRole("complementary", { name: "Datos de la tienda" }),
    ).toBeVisible();
    expect(searches).toEqual(["portal"]);
    expect(previews).toEqual([
      { url: "https://store.steampowered.com/app/620/" },
    ]);
    expect(saves).toHaveLength(0);
    await page
      .getByRole("button", { name: "Guardar entrada", exact: true })
      .click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0]).toMatchObject({
      title: "Portal 2",
      cover: {
        providerUrl:
          "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg",
        provider: "steam",
      },
      pages: ["https://store.steampowered.com/app/620/"],
    });
  });
}

test("empty Steam search shows a no-results state", async ({ page }) => {
  const { searches } = await openEntry(page, { search: "empty" });
  await page.getByLabel("Buscar por título en Steam").fill("unknown game");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByText("No encontramos juegos con ese título."),
  ).toBeVisible();
  expect(searches).toEqual(["unknown game"]);
});

test("Steam search errors remain visible and can be retried", async ({
  page,
}) => {
  const { searches } = await openEntry(page, { search: "error" });
  await page.getByLabel("Buscar por título en Steam").fill("portal");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Steam no disponible.");
  expect(searches).toEqual(["portal"]);
  await expect(
    page.getByRole("button", { name: "Buscar", exact: true }),
  ).toBeEnabled();
});

test("search is disabled while offline", async ({ page, context }) => {
  await openEntry(page);
  await context.setOffline(true);
  const input = page.getByLabel("Buscar por título en Steam");
  await expect(input).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Buscar", exact: true }),
  ).toBeDisabled();
  await context.setOffline(false);
});

test("new-game title search offers Steam and Nintendo providers", async ({
  page,
}) => {
  await openEntry(page);
  const provider = page.getByLabel("Tienda de búsqueda");
  await expect(provider).toHaveValue("steam");
  await expect(provider.locator("option")).toHaveText([
    "Steam",
    "Nintendo (Argentina)",
  ]);
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`Nintendo title search previews and saves the selected game on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const { searches, providers, previews, saves } = await openEntry(page);
    await page.getByLabel("Tienda de búsqueda").selectOption("nintendo");
    await page.getByLabel("Buscar por título en Nintendo").fill("zelda");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    const result = page.getByRole("button", { name: /The Legend of Zelda/ });
    await expect(result).toContainText("Nintendo · Switch");
    expect(searches).toEqual(["zelda"]);
    expect(providers).toEqual(["nintendo"]);
    await result.click();
    await expect(
      page.getByLabel("Nombre del juego", { exact: true }),
    ).toHaveValue("The Legend of Zelda: Breath of the Wild");
    await expect(
      page.getByRole("complementary", { name: "Datos de la tienda" }),
    ).toBeVisible();
    expect(previews).toEqual([
      {
        url: "https://www.nintendo.com/es-ar/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
        includeUsPage: true,
      },
    ]);
    expect(saves).toHaveLength(0);
    await page
      .getByRole("button", { name: "Guardar entrada", exact: true })
      .click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0]).toMatchObject({
      title: "The Legend of Zelda: Breath of the Wild",
      cover: {
        providerUrl:
          "https://assets.nintendo.com/image/upload/the-legend-of-zelda.jpg",
        provider: "nintendo",
      },
      pages: [
        "https://www.nintendo.com/es-ar/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
        "https://www.nintendo.com/us/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
      ],
    });
  });
}

test("canceling a pending result preview preserves a manual draft", async ({
  page,
}) => {
  const { previews, releasePreview } = await openEntry(page, {
    holdPreview: true,
  });
  await page.getByLabel("Buscar por título en Steam").fill("portal");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: "Portal 2" }).click();
  await expect.poll(() => previews.length).toBe(1);
  await page
    .getByRole("button", { name: "Completar manualmente", exact: true })
    .click();
  const title = page.getByLabel("Nombre del juego", { exact: true });
  await title.fill("Manual title");
  releasePreview();
  await expect(title).toHaveValue("Manual title");
  await expect(
    page.getByRole("complementary", { name: "Datos de la tienda" }),
  ).toHaveCount(0);
});

test("search stays editable and a newer query wins over a late response", async ({
  page,
}) => {
  const { searches, releaseSearch } = await openEntry(page, {
    holdSearch: true,
  });
  const input = page.getByLabel("Buscar por título en Steam");
  await input.fill("portal");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect.poll(() => searches.length).toBe(1);
  await expect(input).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Completar manualmente", exact: true }),
  ).toBeEnabled();

  await input.fill("half-life");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect.poll(() => searches.length).toBe(2);
  releaseSearch("steam", "half-life");
  await expect(page.getByRole("button", { name: "Half-Life" })).toBeVisible();
  releaseSearch("steam", "portal");
  await expect(page.getByRole("button", { name: "Portal 2" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Half-Life" })).toBeVisible();
});

test("switching providers cancels the old search and preserves the query", async ({
  page,
}) => {
  const { searches, providers, releaseSearch } = await openEntry(page, {
    holdSearch: true,
  });
  const input = page.locator("#store-title-search");
  await input.fill("zelda");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect.poll(() => searches.length).toBe(1);

  await page.getByLabel("Tienda de búsqueda").selectOption("nintendo");
  await expect(input).toHaveValue("zelda");
  await expect(page.getByRole("button", { name: /Portal 2/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect.poll(() => searches.length).toBe(2);
  releaseSearch("nintendo", "zelda");
  await expect(
    page.getByRole("button", { name: /The Legend of Zelda/ }),
  ).toBeVisible();
  releaseSearch("steam", "zelda");
  await expect(
    page.getByRole("button", { name: /The Legend of Zelda/ }),
  ).toBeVisible();
  expect(providers).toEqual(["steam", "nintendo"]);
});
