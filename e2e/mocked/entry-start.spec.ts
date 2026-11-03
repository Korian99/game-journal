import { test, expect, type Page } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
import type { JournalEntry } from "../../src/lib/journal/journal-types";
import type { StorePreview } from "../../src/lib/offers/store-preview-contract";
const url = "https://store.steampowered.com/app/620/";
const metadata = {
  url,
  store: "steam",
  region: "AR",
  checkedAt: "2026-10-22T12:00:00Z",
  fields: {
    title: "Portal 2",
    platforms: "PC",
    release: "2011-04-18",
    year: 2011,
  },
  quote: {
    name: "Portal 2",
    status: "available",
    price: 2,
    regular: 10,
    currency: "USD",
    discount: 80,
  },
} satisfies StorePreview;
async function fixture(
  page: Page,
  lookup: StorePreview = metadata,
  existing?: JournalEntry,
  tab = "wishlist",
) {
  const saves: Record<string, unknown>[] = [];
  const lookups: unknown[] = [];
  const searches: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/store-search") {
      const requestUrl = new URL(route.request().url());
      const store = requestUrl.searchParams.get("store") ?? "steam";
      const term = requestUrl.searchParams.get("q") ?? "";
      searches.push(`${store}:${term}`);
      return route.fulfill({
        json: {
          results:
            store === "nintendo"
              ? [
                  {
                    store: "nintendo",
                    title: "Pragmata",
                    id: "pragmata-switch",
                    url: "https://www.nintendo.com/us/store/products/pragmata-switch/",
                    platform: "Switch",
                  },
                ]
              : [
                  {
                    store: "steam",
                    title: "Portal 2",
                    id: "620",
                    url,
                    platform: "PC",
                    cover: {
                      provider: "steam",
                      providerUrl:
                        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg",
                    },
                  },
                ],
        },
      });
    }
    if (path === "/api/store-preview") {
      lookups.push(route.request().postDataJSON());
      return route.fulfill({ json: lookup });
    }
    if (path === "/api/records") {
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
          records: existing ? [existing] : [],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    }
    return route.fulfill({
      json:
        path === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : path === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : path === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  await page.goto("./?tab=" + tab);
  if (existing)
    await page
      .getByRole("button", {
        name: "Ver detalles de " + existing.title,
        exact: true,
      })
      .click();
  else
    await page
      .getByRole("button", { name: "Agregar juego", exact: true })
      .click();
  return { saves, lookups, searches };
}
async function openPageLookup(page: Page) {
  await page
    .getByRole("button", { name: "Completar manualmente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Completar desde una página", exact: true })
    .click();
}
for (const tab of ["library", "journal", "wishlist", "upcoming"]) {
  test(
    "manual creation in " +
      tab +
      " defaults to wishlist without calling a store",
    async ({ page }) => {
      if (tab === "wishlist")
        await page.setViewportSize({ width: 390, height: 844 });
      const { saves, lookups } = await fixture(page, metadata, undefined, tab);
      await expect(
        page.getByRole("heading", { name: "¿Cómo querés cargar el juego?" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Usar una página", exact: true }),
      ).toHaveCount(0);
      await expect(page.getByLabel("Buscar por título en Steam")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Guardar entrada", exact: true }),
      ).toHaveCount(0);
      await page.screenshot({
        path:
          tab === "wishlist"
            ? "test-results/entry-start-choice-mobile.png"
            : "test-results/entry-start-choice.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Completar manualmente", exact: true })
        .click();
      await page
        .getByLabel("Nombre del juego", { exact: true })
        .fill("Manual game");
      await expect(
        page
          .getByLabel("Estado", { exact: true })
          .locator("option")
          .filter({ hasText: /^Pendiente$/ }),
      ).toHaveCount(0);
      await page.getByLabel("Prioridad", { exact: true }).fill("3");
      await page
        .getByRole("button", { name: "Guardar entrada", exact: true })
        .click();
      await expect.poll(() => saves.length).toBe(1);
      expect(saves[0]).toMatchObject({
        title: "Manual game",
        priority: 3,
        status: "wishlist",
      });
      expect(lookups).toHaveLength(0);
    },
  );
}
test("a future release defaults a new game to Próximos until status is chosen", async ({
  page,
}) => {
  const { saves } = await fixture(page);
  await page
    .getByRole("button", { name: "Completar manualmente", exact: true })
    .click();
  await page
    .getByLabel("Nombre del juego", { exact: true })
    .fill("Future game");
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await page.getByLabel("Precisión del lanzamiento").selectOption("date");
  const release = page.getByLabel("Fecha de lanzamiento", { exact: true });
  await release.fill("2199-01-01");
  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  const status = page.getByLabel("Estado", { exact: true });
  await expect(status).toHaveValue("upcoming");

  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await release.fill("2011-01-01");
  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  await expect(status).toHaveValue("wishlist");

  await status.selectOption("wishlist");
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await release.fill("2199-01-01");
  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  await expect(status).toHaveValue("wishlist");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({ title: "Future game", status: "wishlist" });
});

test("store upcoming previews default new games to Próximos", async ({
  page,
}) => {
  const futurePreview = {
    ...metadata,
    fields: { ...metadata.fields, release: "2199-01-01", year: 2199 },
    quote: { ...metadata.quote, status: "upcoming" },
  };
  const { saves } = await fixture(page, futurePreview);
  await openPageLookup(page);
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(page.getByLabel("Estado", { exact: true })).toHaveValue(
    "upcoming",
  );
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({ status: "upcoming", year: 2199 });
});

test("editing an existing entry keeps its selected status with a future release", async ({
  page,
}) => {
  const existing: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Existing paused game",
    status: "paused",
    period: "2024",
    release: "2011-04-18",
    year: 2011,
  };
  const { saves } = await fixture(page, metadata, existing, "journal");
  const status = page.getByLabel("Estado", { exact: true });
  await expect(status).toHaveValue("paused");
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await page.getByLabel("Precisión del lanzamiento").selectOption("date");
  await page
    .getByLabel("Fecha de lanzamiento", { exact: true })
    .fill("2199-01-01");
  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  await expect(status).toHaveValue("paused");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({ id: existing.id, status: "paused" });
});

test("invalid cover survives a provider preview and blocks save until reset", async ({
  page,
}) => {
  const providerUrl =
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg";
  const existing: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Existing cover game",
    status: "wishlist",
    cover: { provider: "steam", providerUrl },
  };
  const previewWithCover = {
    ...metadata,
    cover: {
      provider: "nintendo" as const,
      providerUrl: "https://assets.nintendo.com/image/upload/preview.jpg",
    },
  };
  const { saves } = await fixture(page, previewWithCover, existing, "wishlist");
  const coverInput = page.getByLabel("URL de portada", { exact: true });
  await coverInput.fill("https://example.org/not-approved.jpg");
  await expect(
    page.getByText("Usá una URL HTTPS de un proveedor aprobado."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Completar desde una página", exact: true })
    .click();
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(coverInput).toHaveValue("https://example.org/not-approved.jpg");
  await expect(
    page.getByRole("img", { name: "Sin portada de Portal 2" }),
  ).toHaveCount(0);
  await expect(page.locator(".cover-editor img")).toHaveCount(0);
  await expect(
    page.getByText("Usá una URL HTTPS de un proveedor aprobado."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  expect(saves).toHaveLength(0);
  await expect(coverInput).toBeFocused();

  await coverInput.fill("https://assets.nintendo.com/image/upload/manual.jpg");
  await page
    .getByRole("button", { name: "Restablecer portada de tienda" })
    .click();
  await expect(coverInput).toHaveValue("");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].cover).toEqual({ provider: "steam", providerUrl });
});

test("Steam lookup fills an editable draft and waits for an explicit save", async ({
  page,
}) => {
  const { saves, lookups } = await fixture(page);
  await openPageLookup(page);
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Portal 2");
  expect(saves).toHaveLength(0);
  expect(lookups).toEqual([{ url }]);
  await expect(
    page.getByRole("link", { name: url, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("80% OFF", { exact: true })).toBeVisible();
  await page
    .getByLabel("Nombre del juego", { exact: true })
    .fill("Portal 2 — mi partida");
  await page.getByLabel("Prioridad", { exact: true }).fill("1");
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await expect(
    page.getByLabel("Fecha de lanzamiento", { exact: true }),
  ).toHaveValue("2011-04-18");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({
    title: "Portal 2 — mi partida",
    platforms: "PC",
    release: "2011-04-18",
    year: 2011,
    pages: [url],
    priority: 1,
    status: "wishlist",
  });
});
test("Nintendo lookup also works on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const nintendo = "https://www.nintendo.com/es-ar/store/products/test-switch/";
  const { saves } = await fixture(page, {
    ...metadata,
    url: nintendo,
    store: "nintendo",
    fields: {
      title: "Nintendo fixture",
      platforms: "Nintendo Switch 2",
      release: "2026-12-05",
      year: 2026,
    },
  });
  await openPageLookup(page);
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(nintendo);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Nintendo fixture");
  expect(saves).toHaveLength(0);
  await page.screenshot({
    path: "test-results/entry-start-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Descartar cambios", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Seguir editando", exact: true })
    .click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Nintendo fixture");
});
test("lookup errors allow retry or manual completion without losing the URL", async ({
  page,
}) => {
  const { saves } = await fixture(page);
  await page.route("**/api/store-preview", (route) =>
    route.fulfill({
      status: 503,
      json: { code: "TEMPORARY", error: "La tienda no respondió." },
    }),
  );
  await openPageLookup(page);
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("La tienda no respondió.");
  await expect(
    page.getByRole("button", { name: "Traer datos", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Completar manualmente", exact: true })
    .click();
  await expect(
    page.getByLabel("Enlace de página", { exact: true }),
  ).toHaveValue(url);
  expect(saves).toHaveLength(0);
});

test("looking up another page preserves the personal draft", async ({
  page,
}) => {
  const { saves } = await fixture(page);
  await page
    .getByRole("button", { name: "Completar manualmente", exact: true })
    .click();
  await page.getByLabel("Nombre del juego", { exact: true }).fill("Old name");
  await page.getByLabel("Prioridad", { exact: true }).fill("2");
  await page.getByRole("tab", { name: "Reseña", exact: true }).click();
  await page
    .getByRole("textbox", {
      name: "Comentarios adicionales · privados",
      exact: true,
    })
    .fill("My personal review");
  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  await page
    .getByRole("button", { name: "Completar desde una página", exact: true })
    .click();
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Portal 2");
  await expect(page.getByLabel("Prioridad", { exact: true })).toHaveValue("2");
  await page.getByRole("tab", { name: "Reseña", exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Comentarios adicionales · privados",
      exact: true,
    }),
  ).toHaveValue("My personal review");
  expect(saves).toHaveLength(0);
});

test("switching to manual entry cancels a pending lookup without overwriting the draft", async ({
  page,
}) => {
  const { saves } = await fixture(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delivered = false;
  await page.route("**/api/store-preview", async (route) => {
    await gate;
    await route.fulfill({ json: metadata }).catch(() => {});
    delivered = true;
  });
  await openPageLookup(page);
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Buscando…", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Completar manualmente", exact: true })
    .click();
  await page
    .getByLabel("Nombre del juego", { exact: true })
    .fill("Manual draft");
  release();
  await expect.poll(() => delivered).toBe(true);
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Manual draft");
  expect(saves).toHaveLength(0);
});

test("a page lookup updates the existing entry and clearly identifies the edit", async ({
  page,
}) => {
  const existing: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Existing fixture",
    status: "wishlist",
    priority: 3,
    updated_at: "2026-10-22T09:00:00Z",
    notes: "Keep my review",
    pages: ["https://example.org/old-page"],
  };
  const { saves } = await fixture(
    page,
    {
      ...metadata,
      cover: {
        provider: "steam",
        providerUrl:
          "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg",
      },
    },
    existing,
  );
  await expect(
    page.getByRole("heading", { name: "Tu partida", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Completar desde una página", exact: true })
    .click();
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tu partida", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Portal 2");
  expect(saves).toHaveLength(0);
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({
    id: existing.id,
    gameId: existing.gameId,
    updated_at: existing.updated_at,
    title: "Portal 2",
    priority: 3,
    notes: "Keep my review",
    pages: ["https://example.org/old-page", url],
    cover: {
      provider: "steam",
      providerUrl:
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg",
    },
  });
});

test("store search completes the existing entry and carries its game cover", async ({
  page,
}) => {
  const existing: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Portal 2",
    status: "playing",
    started: "2026-10-01",
    priority: 3,
    notes: "Keep my review",
    updated_at: "2026-10-22T09:00:00Z",
    pages: ["https://example.org/old-page"],
  };
  const { saves } = await fixture(page, metadata, existing, "library");
  await page
    .getByRole("button", { name: "Completar desde el buscador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Completar desde el buscador" }),
  ).toBeVisible();
  await expect(page.getByLabel("Buscar por título en Steam")).toHaveValue(
    existing.title,
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/store-completion-entry-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/store-completion-entry-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Volver a la edición", exact: true })
    .click();
  await expect(page.getByLabel("Estado", { exact: true })).toHaveValue(
    "playing",
  );
  await expect(page.getByLabel("Prioridad", { exact: true })).toHaveValue("3");
  await page.getByRole("tab", { name: "Reseña", exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Comentarios adicionales · privados",
      exact: true,
    }),
  ).toHaveValue("Keep my review");
  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  await page
    .getByRole("button", { name: "Completar desde el buscador", exact: true })
    .click();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page
    .getByRole("list", { name: "Resultados de tienda" })
    .getByRole("button")
    .filter({ hasText: "Portal 2" })
    .click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Portal 2");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({
    id: existing.id,
    gameId: existing.gameId,
    updated_at: existing.updated_at,
    status: "playing",
    started: "01/10/2026",
    priority: 3,
    notes: existing.notes,
    cover: {
      provider: "steam",
      providerUrl:
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg",
    },
    pages: ["https://example.org/old-page", url],
  });
});

test("store search can be opened from a manual new-game draft", async ({
  page,
}) => {
  const { saves } = await fixture(page);
  await page
    .getByRole("button", { name: "Completar manualmente", exact: true })
    .click();
  await page.getByLabel("Nombre del juego", { exact: true }).fill("Portal 2");
  await page
    .getByRole("button", { name: "Completar desde el buscador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Completar desde el buscador" }),
  ).toBeVisible();
  await expect(page.getByLabel("Buscar por título en Steam")).toHaveValue(
    "Portal 2",
  );
  await expect(
    page.getByRole("list", { name: "Resultados de tienda" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a la edición", exact: true })
    .click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Portal 2");
  expect(saves).toHaveLength(0);
});

for (const source of [
  {
    store: "steam",
    title: "Portal 2",
    page: undefined,
    result: "Portal 2",
  },
  {
    store: "steam",
    title: "Portal 2",
    page: url,
    result: "Portal 2",
  },
  {
    store: "nintendo",
    title: "Pragmata",
    page: "https://www.nintendo.com/us/store/products/pragmata-switch/",
    result: "Pragmata",
  },
  {
    store: "nintendo",
    title: "Pragmata",
    page: "https://www.nintendo.com/es-ar/games/pragmata/",
    result: "Pragmata",
  },
]) {
  test(`saved ${source.store} ${source.page ?? "title only"} opens completed title search without selecting`, async ({
    page,
  }) => {
    const existing: JournalEntry = {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000001",
      gameId: "30000000-0000-4000-8000-000000000001",
      title: source.title,
      status: "playing",
      started: "2026-10-01",
      pages: source.page ? [url, source.page] : [],
    };
    const { saves, lookups, searches } = await fixture(
      page,
      metadata,
      existing,
      "library",
    );
    await page
      .getByRole("button", { name: "Completar desde el buscador", exact: true })
      .click();
    await expect(
      page
        .getByRole("list", { name: "Resultados de tienda" })
        .getByRole("button")
        .filter({ hasText: source.result }),
    ).toBeVisible();
    await expect(
      page
        .getByLabel("Buscar por título en Steam")
        .or(page.getByLabel("Buscar por título en Nintendo")),
    ).toHaveValue(source.title);
    await expect(page.getByLabel("Tienda de búsqueda")).toHaveValue(
      source.store,
    );
    expect(searches).toEqual([`${source.store}:${source.title}`]);
    expect(lookups).toHaveLength(0);
    expect(saves).toHaveLength(0);
    await expect(
      page.getByRole("button", { name: "Guardar entrada", exact: true }),
    ).toHaveCount(0);
  });
}

test("selecting a visible search cover replaces stale provider art", async ({
  page,
}) => {
  const oldCover =
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/old-header.jpg";
  const selectedCover =
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/selected-capsule.jpg";
  const existing: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Portal 2",
    status: "playing",
    started: "2026-10-01",
    pages: [url],
    cover: { provider: "steam", providerUrl: oldCover },
  };
  await page.route("**/store_item_assets/**", async (route) => {
    const imageUrl = route.request().url();
    if (imageUrl === selectedCover)
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="#64777a"/><rect width="50" height="100" fill="#c4a254"/><rect x="350" width="50" height="100" fill="#c4a254"/></svg>',
      });
    return route.fulfill({ status: 404, body: "missing" });
  });
  const { saves } = await fixture(
    page,
    {
      ...metadata,
      cover: {
        provider: "steam",
        providerUrl:
          "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/preview-header.jpg",
      },
    },
    existing,
    "library",
  );
  await page.route("**/api/store-search?**", (route) => {
    return route.fulfill({
      json: {
        results: [
          {
            store: "steam",
            title: "Portal 2",
            id: "620",
            url,
            platform: "PC",
            cover: { provider: "steam", providerUrl: selectedCover },
          },
        ],
      },
    });
  });
  await page
    .getByRole("button", { name: "Completar desde el buscador", exact: true })
    .click();
  const result = page
    .getByRole("list", { name: "Resultados de tienda" })
    .getByRole("button")
    .filter({ hasText: "Portal 2" });
  await expect(result.locator("img")).toHaveAttribute("src", selectedCover);
  await expect
    .poll(() =>
      result
        .locator("img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/store-cover-search-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/store-cover-search-mobile.png",
    fullPage: true,
  });
  await result.click();
  await expect(page.locator(".cover-editor img")).toHaveAttribute(
    "src",
    selectedCover,
  );
  await expect
    .poll(() =>
      page
        .locator(".cover-editor img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/store-cover-search-selected-mobile.png",
    fullPage: true,
  });
  await page.getByText("Portadas de otras consolas", { exact: true }).click();
  await expect(page.getByText(/MobyGames \(cdn.mobygames.com\)/)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/cover-editor-uncropped-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/cover-editor-uncropped-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].cover).toEqual({
    provider: "steam",
    providerUrl: selectedCover,
  });
});

test("an existing-game lookup is labeled as editing, not starting a new game", async ({
  page,
}) => {
  const existing: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Existing fixture",
    status: "wishlist",
  };
  const { saves } = await fixture(page, metadata, existing);
  await page
    .getByRole("button", { name: "Completar desde una página", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Actualizar datos de Existing fixture",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a la edición", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu partida", exact: true }),
  ).toBeVisible();
  expect(saves).toHaveLength(0);
});

test("a conflicting page on a playing entry offers updating that entry instead of a replay", async ({
  page,
}) => {
  const playing: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Playing fixture",
    status: "playing",
    started: "2026-10-01",
    hours: 12,
    notes: "Keep my current playthrough",
    updated_at: "2026-10-22T09:00:00Z",
  };
  const match: JournalEntry = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000002",
    gameId: "30000000-0000-4000-8000-000000000002",
    title: "Portal 2",
    status: "wishlist",
    pages: [url],
  };
  await fixture(page, metadata, playing, "library");
  const submissions: Record<string, unknown>[] = [];
  await page.route("**/api/records", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const input = route.request().postDataJSON();
    submissions.push(input);
    if (!input.allowDuplicate)
      return route.fulfill({
        status: 409,
        json: {
          code: "DUPLICATE",
          error: "Este juego podría estar repetido.",
          details: { matches: [match] },
        },
      });
    return route.fulfill({
      json: {
        id: playing.id,
        gameId: playing.gameId,
        record: { ...playing, ...input },
      },
    });
  });
  await page
    .getByRole("button", { name: "Completar desde una página", exact: true })
    .click();
  await page
    .getByLabel("Página de Steam o Nintendo", { exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Traer datos", exact: true }).click();
  await expect(page.getByLabel("Estado", { exact: true })).toHaveValue(
    "playing",
  );
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  const warning = page.getByRole("dialog").last();
  await expect(
    warning.getByRole("heading", {
      name: "Coincidencia con otro juego",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    warning.getByRole("button", {
      name: "Crear otra partida de este juego",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    warning.getByRole("button", {
      name: "Guardar como juego separado",
      exact: true,
    }),
  ).toHaveCount(0);
  await warning
    .getByRole("button", { name: "Volver a la edición", exact: true })
    .click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Portal 2");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Guardar cambios en esta partida",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(submissions).toHaveLength(3);
  for (const input of submissions)
    expect(input).toMatchObject({
      id: playing.id,
      gameId: playing.gameId,
      status: "playing",
      started: "01/10/2026",
      hours: 12,
      notes: playing.notes,
      updated_at: playing.updated_at,
      pages: [url],
    });
  expect(submissions[2].allowDuplicate).toBe(true);
});
