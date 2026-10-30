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
};

async function openEntry(page: Page, options: FixtureOptions = {}) {
  const saves: Record<string, unknown>[] = [];
  const searches: string[] = [];
  const searchReleases = new Map<string, () => void>();
  const previews: Record<string, unknown>[] = [];
  let releasePreview: (() => void) | undefined;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/store-search") {
      const term = url.searchParams.get("q") ?? "";
      searches.push(term);
      if (options.holdSearch)
        await new Promise<void>((resolve) => searchReleases.set(term, resolve));
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
              : term === "half-life"
                ? [
                    {
                      store: "steam",
                      title: "Half-Life",
                      id: "70",
                      url: "https://store.steampowered.com/app/70/",
                    },
                  ]
                : [
                    ...Array.from({ length: 8 }, (_, index) => ({
                      store: "steam",
                      title: `Portal Companion ${index + 1}`,
                      id: String(500 + index),
                      url: `https://store.steampowered.com/app/${500 + index}/`,
                    })),
                    {
                      store: "steam",
                      title: "Portal 2",
                      id: "620",
                      url: "https://store.steampowered.com/app/620/",
                    },
                  ],
        },
      });
    }
    if (url.pathname === "/api/store-preview") {
      previews.push(route.request().postDataJSON());
      if (options.holdPreview)
        await new Promise<void>((resolve) => {
          releasePreview = resolve;
        });
      try {
        return await route.fulfill({ json: preview });
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
    previews,
    releasePreview: () => releasePreview?.(),
    releaseSearch: (term: string) => searchReleases.get(term)?.(),
  };
}

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
  releaseSearch("half-life");
  await expect(page.getByRole("button", { name: "Half-Life" })).toBeVisible();
  releaseSearch("portal");
  await expect(page.getByRole("button", { name: "Portal 2" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Half-Life" })).toBeVisible();
});
