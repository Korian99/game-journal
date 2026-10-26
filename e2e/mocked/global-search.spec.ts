import { test, expect, type Page, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

const id = (value: number) =>
  "20000000-0000-4000-8000-" + String(value).padStart(12, "0");
const gameId = (value: number) =>
  "30000000-0000-4000-8000-" + String(value).padStart(12, "0");
const records = [
  {
    ...emptyRecord,
    id: id(1),
    gameId: gameId(1),
    title: "Pokémon Platinum",
    status: "remembered",
    device: "Nintendo DS",
    period: "2012",
    updated_at: "2026-01-01T12:00:00Z",
  },
  {
    ...emptyRecord,
    id: id(2),
    gameId: gameId(2),
    title: "Final Fantasy VII",
    status: "completed",
    device: "PC",
    started: "2024-01-01",
    finished: "2024-02-01",
    period: "2024",
    updated_at: "2026-01-01T12:00:00Z",
  },
  {
    ...emptyRecord,
    id: id(3),
    gameId: gameId(2),
    title: "Final Fantasy VII",
    status: "paused",
    device: "Switch",
    started: "2026-01-01",
    period: "2026",
    updated_at: "2026-01-01T12:00:00Z",
  },
  {
    ...emptyRecord,
    id: id(4),
    gameId: gameId(3),
    title: "Future fixture",
    status: "upcoming",
    updated_at: "2026-01-01T12:00:00Z",
  },
];
async function setup(page: Page) {
  let rows = records.map((record) => ({ ...record }));
  let fail = false;
  let pending: Route | undefined;
  const writes: unknown[] = [];
  const apiCalls: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    apiCalls.push(path);
    if (path === "/api/records") {
      if (route.request().method() === "POST") {
        writes.push(route.request().postDataJSON());
        pending = route;
        return;
      }
      return fail
        ? route.fulfill({ status: 503, json: { error: "Refresh unavailable" } })
        : route.fulfill({
            json: {
              records: rows,
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
            ? {
                shared: [
                  {
                    shareId: "shared",
                    owner: "Someone",
                    title: "Private shared fixture",
                    device: "PC",
                    hours: null,
                    rating: null,
                    memorability: null,
                  },
                ],
                members: [],
                grants: [],
              }
            : path === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  return {
    writes,
    apiCalls,
    async reject() {
      await pending!.fulfill({
        status: 409,
        json: { error: "La entrada cambió", code: "CONFLICT" },
      });
    },
    addGames(count: number) {
      for (let index = 0; index < count; index++)
        rows.push({
          ...records[0],
          id: id(100 + index),
          gameId: gameId(100 + index),
          title: "Search fixture " + index,
        });
    },
    fail: () => {
      fail = true;
    },
    async succeed() {
      const data = pending!.request().postDataJSON();
      rows = rows.map((row) =>
        row.id === data.id
          ? { ...row, ...data, updated_at: "2026-01-02T12:00:00Z" }
          : row,
      );
      await pending!.fulfill({
        json: {
          id: data.id,
          gameId: data.gameId,
          record: rows.find((row) => row.id === data.id),
        },
      });
    },
  };
}
const search = (page: Page) =>
  page.getByRole("searchbox", {
    name: "Buscar en todos mis juegos",
    exact: true,
  });
test("global search groups replays and opens the exact entry across hidden filters and history", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=wishlist&q=unrelated&platform=PC");
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  await search(page).fill("Final VII");
  const dialog = page.getByRole("dialog", {
    name: "Buscar en todos mis juegos",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: "Final Fantasy VII", exact: true }),
  ).toHaveCount(1);
  await expect(
    dialog.getByRole("button", { name: /Abrir partida/ }),
  ).toHaveCount(2);
  await dialog
    .getByRole("button", { name: /Abrir partida.*Terminado.*PC/ })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp("tab=library.*entry=" + id(2)));
  const row = page.locator('table tr[data-entry-id="' + id(2) + '"]');
  await expect(row).toHaveClass(/notification-highlight/);
  await expect(row.locator(".game-cell")).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/tab=wishlist.*q=unrelated/);
  expect(f.writes).toHaveLength(0);
});
test("keyboard search works from settings, preserves focus and does not steal editor shortcuts", async ({
  page,
}) => {
  await setup(page);
  await page.goto("./?tab=settings");
  await page.keyboard.press("Control+k");
  await expect(search(page)).toBeFocused();
  await search(page).fill("POKEMON!");
  await search(page).press("ArrowDown");
  await expect(
    page.getByRole("button", { name: /Abrir partida.*Pokémon/ }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", {
      name: "Buscar en todos mis juegos",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Buscar en todos mis juegos",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Control+k");
  await search(page).fill("pokemon");
  await search(page).press("Enter");
  await expect(page).toHaveURL(new RegExp("tab=journal.*entry=" + id(1)));
  await page
    .getByRole("button", {
      name: "Ver detalles de Pokémon Platinum",
      exact: true,
    })
    .click();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", {
      name: "Buscar en todos mis juegos",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("dirty inline navigation requires a decision and a failed save keeps the draft", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .locator('tr[data-entry-id="' + id(2) + '"]')
    .getByRole("button", {
      name: "Editar Nombre de Final Fantasy VII",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Changed title");
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  await search(page).fill("Future");
  await page.getByRole("button", { name: /Abrir partida.*Future/ }).click();
  await expect(
    page.getByText("Tenés una edición sin guardar.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Seguir editando", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveValue("Changed title");
  expect(f.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  await search(page).fill("Future");
  await page.getByRole("button", { name: /Abrir partida.*Future/ }).click();
  await page
    .getByRole("button", { name: "Guardar y abrir", exact: true })
    .click();
  await expect.poll(() => f.writes.length).toBe(1);
  await f.reject();
  const dialog = page.getByRole("dialog", {
    name: "Buscar en todos mis juegos",
    exact: true,
  });
  await expect(dialog.getByRole("alert")).toContainText("La entrada cambió");
  await expect(page).toHaveURL(/tab=library/);
  await page
    .getByRole("button", { name: "Seguir editando", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveValue("Changed title");
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  await search(page).fill("Future");
  await page.getByRole("button", { name: /Abrir partida.*Future/ }).click();
  await page
    .getByRole("button", { name: "Descartar y abrir", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("tab=upcoming.*entry=" + id(4)));
  expect(f.writes).toHaveLength(1);
});
test("mobile search retains results after refresh failure and excludes shared entries", async ({
  page,
}) => {
  const f = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?tab=library&year=all");
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  await search(page).fill("Private shared");
  await expect(
    page.getByText("No hay coincidencias.", { exact: true }),
  ).toBeVisible();
  await search(page).fill("pokemon");
  await expect(
    page.getByRole("button", { name: /Abrir partida.*Pokémon/ }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/global-search-mobile.png" });
  f.fail();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const dialog = page.getByRole("dialog", {
    name: "Buscar en todos mis juegos",
    exact: true,
  });
  await expect(dialog.getByRole("alert")).toContainText(
    "Se conserva la última versión",
  );
  await expect(
    dialog.getByRole("button", { name: /Abrir partida.*Pokémon/ }),
  ).toBeVisible();
  expect(f.apiCalls).not.toContain("/api/refresh");
  expect(f.writes).toHaveLength(0);
});

test("initial loading and failed loading never appear as an empty collection", async ({
  page,
}) => {
  await setup(page);
  const reads: Route[] = [];
  await page.route("**/api/records?*", (route) => {
    reads.push(route);
  });
  await page.goto("./?tab=library");
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  await search(page).fill("pokemon");
  const dialog = page.getByRole("dialog", {
    name: "Buscar en todos mis juegos",
    exact: true,
  });
  await expect(dialog.getByRole("status")).toContainText("Cargando juegos");
  await expect(
    dialog.getByText("No hay coincidencias.", { exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => reads.length).toBe(1);
  await reads[0].fulfill({ status: 503, json: { error: "Unavailable" } });
  await expect(dialog.getByRole("alert")).toContainText(
    "No se pudieron cargar tus juegos",
  );
  await expect(
    dialog.getByText("No hay coincidencias.", { exact: true }),
  ).toHaveCount(0);
});
test("results load progressively and search makes no network requests", async ({
  page,
}) => {
  const f = await setup(page);
  f.addGames(35);
  await page.goto("./?tab=settings");
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  const before = f.apiCalls.length;
  await search(page).fill("Search fixture");
  const dialog = page.getByRole("dialog", {
    name: "Buscar en todos mis juegos",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: /Abrir partida/ }),
  ).toHaveCount(30);
  await page.screenshot({ path: "test-results/global-search-desktop.png" });
  await dialog
    .getByRole("button", { name: "Mostrar más partidas (5)", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: /Abrir partida/ }),
  ).toHaveCount(35);
  expect(f.apiCalls.length).toBe(before);
});

test("saving an inline draft before opening a search result waits for the confirmed save", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .locator('tr[data-entry-id="' + id(2) + '"]')
    .getByRole("button", {
      name: "Editar Nombre de Final Fantasy VII",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Saved title");
  await page
    .getByRole("button", { name: "Buscar en todos mis juegos", exact: true })
    .click();
  await search(page).fill("Future");
  await page.getByRole("button", { name: /Abrir partida.*Future/ }).click();
  await page
    .getByRole("button", { name: "Guardar y abrir", exact: true })
    .click();
  await expect.poll(() => f.writes.length).toBe(1);
  await expect(page).toHaveURL(/tab=library/);
  await f.succeed();
  await expect(page).toHaveURL(new RegExp("tab=upcoming.*entry=" + id(4)));
  expect(f.writes).toHaveLength(1);
});
