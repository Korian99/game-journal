import { expect, test } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

test("series create, reorder, rename, reload, delete, and failed saves retain drafts", async ({
  page,
}) => {
  const records = [
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000001",
      gameId: "10000000-0000-4000-8000-000000000001",
      title: "Game A",
      status: "playing",
      finished: "2026-01-01",
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/series-a.jpg",
      },
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000002",
      gameId: "10000000-0000-4000-8000-000000000002",
      title: "Game B",
      status: "completed",
      finished: "2026-01-02",
      cover: {
        provider: "steam",
        providerUrl: "https://shared.fastly.steamstatic.com/broken.jpg",
      },
    },
  ];
  const state: {
    series: {
      id: string;
      name: string;
      updatedAt: string;
      gameIds: string[];
    }[];
    failSaves: number;
  } = { series: [], failSaves: 0 };
  await page.route("https://assets.nintendo.com/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#65777b"/><circle cx="60" cy="70" r="30" fill="#c4a254"/></svg>',
    }),
  );
  await page.route("https://shared.fastly.steamstatic.com/**", (route) =>
    route.fulfill({ status: 404, body: "Missing cover" }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/records")
      return route.fulfill({
        json: {
          records,
          member: {
            id: "10000000-0000-4000-8000-000000000099",
            display_name: "Fixture",
            role: "member",
          },
        },
      });
    if (path === "/api/notifications")
      return route.fulfill({
        json: {
          items: [],
          unreadCount: 0,
          nextCursor: null,
          checkedAt: new Date().toISOString(),
        },
      });
    if (path === "/api/sharing")
      return route.fulfill({ json: { shared: [], members: [], grants: [] } });
    if (path === "/api/offers") return route.fulfill({ json: [] });
    if (path === "/api/series" && request.method() === "GET")
      return route.fulfill({ json: state.series });
    if (path === "/api/series" && request.method() === "POST") {
      if (state.failSaves) {
        state.failSaves--;
        return route.fulfill({
          status: 409,
          json: { error: "Series changed", code: "CONFLICT" },
        });
      }
      const body = request.postDataJSON() as {
        id?: string;
        name: string;
        gameIds: string[];
        updatedAt?: string;
      };
      const value = {
        id: body.id ?? "30000000-0000-4000-8000-000000000001",
        name: body.name,
        gameIds: body.gameIds,
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      };
      state.series = body.id
        ? state.series.map((item) => (item.id === body.id ? value : item))
        : [...state.series, value];
      return route.fulfill({ json: value });
    }
    if (path === "/api/series" && request.method() === "DELETE") {
      const body = request.postDataJSON() as { id: string };
      state.series = state.series.filter((item) => item.id !== body.id);
      return route.fulfill({ json: { deleted: true } });
    }
    if (path === "/api/backups/drive")
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
    if (path === "/api/backups")
      return route.fulfill({
        json: {
          checkedAt: new Date().toISOString(),
          latest: null,
          lastSuccess: null,
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library&year=all");
  await page.getByRole("link", { name: "Series", exact: true }).click();
  await expect(page).toHaveURL(/tab=library&section=series/);
  const seriesPage = page.getByRole("region", { name: "Series" });
  await seriesPage.getByRole("button", { name: "Crear serie" }).click();
  await seriesPage.getByLabel("Nombre").fill("My saga");
  await seriesPage
    .getByLabel("Buscar juegos para agregar a la serie")
    .fill("Game A");
  await seriesPage
    .getByLabel("Agregar juego")
    .selectOption("10000000-0000-4000-8000-000000000001");
  await seriesPage
    .getByLabel("Buscar juegos para agregar a la serie")
    .fill("Game B");
  await seriesPage
    .getByLabel("Agregar juego")
    .selectOption("10000000-0000-4000-8000-000000000002");
  await seriesPage.getByRole("button", { name: "Mover Game B arriba" }).click();
  await seriesPage.getByRole("button", { name: "Guardar serie" }).click();
  await expect(
    seriesPage.getByRole("heading", { name: "My saga" }),
  ).toBeVisible();
  await expect(
    seriesPage.getByRole("progressbar", { name: "Progreso de la serie" }),
  ).toHaveAttribute("value", "1");
  await expect(
    seriesPage.getByText("1 de 2 juegos terminados", { exact: true }),
  ).toBeVisible();
  await expect(
    seriesPage.getByText("Siguiente: Game A", { exact: true }),
  ).toBeVisible();
  await expect(
    seriesPage
      .getByRole("list", { name: "Juegos de la serie" })
      .getByRole("listitem"),
  ).toHaveText([/Game B.*Terminado/, /Game A.*Pendiente/]);
  expect(state.series[0].gameIds).toEqual([
    records[1].gameId,
    records[0].gameId,
  ]);
  await page.screenshot({
    path: "test-results/series-progress-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await expect(page).toHaveURL(/tab=library(?:&|$)/);
  await page.goBack();
  await expect(page).toHaveURL(/tab=library&section=series/);
  await page.reload();
  await expect(
    seriesPage.getByRole("table", { name: "Tus series" }),
  ).toBeVisible();
  await expect(
    seriesPage.getByRole("row", { name: /My saga.*1\/2.*Game A/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/series-overview-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const overviewRow = seriesPage.getByRole("row", { name: /My saga/ });
  await expect(overviewRow.locator("th small")).toHaveText(
    "1/2 terminados",
  );
  await expect(overviewRow.locator("th small")).toBeVisible();
  await page.screenshot({
    path: "test-results/series-overview-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seriesPage.getByRole("button", { name: "Abrir My saga" }).click();
  await expect(
    seriesPage.getByRole("heading", { name: "My saga" }),
  ).toBeVisible();
  await seriesPage.getByRole("button", { name: "Editar serie" }).click();
  await expect(seriesPage.locator("ol li span")).toHaveText([
    "Game B",
    "Game A",
  ]);
  await seriesPage.getByLabel("Nombre").fill("Updated saga");
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("link", { name: "Series", exact: true }).click();
  await expect(seriesPage.getByLabel("Nombre")).toHaveValue("Updated saga");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/series-mobile.png",
    fullPage: true,
  });
  await seriesPage.getByRole("button", { name: "Guardar serie" }).click();
  expect(state.series[0].name).toBe("Updated saga");
  await expect(
    seriesPage.getByText("1 de 2 juegos terminados", { exact: true }),
  ).toBeVisible();
  await expect(
    seriesPage.getByRole("list", { name: "Juegos de la serie" }).locator("img"),
  ).toHaveCount(1);
  await page.screenshot({
    path: "test-results/series-progress-mobile.png",
    fullPage: true,
  });
  state.failSaves = 1;
  await seriesPage.getByRole("button", { name: "Editar serie" }).click();
  await seriesPage.getByLabel("Nombre").fill("Draft survives");
  await seriesPage.getByRole("button", { name: "Guardar serie" }).click();
  await expect(seriesPage.getByRole("alert")).toBeVisible();
  await expect(seriesPage.getByLabel("Nombre")).toHaveValue("Draft survives");
  await seriesPage.getByRole("button", { name: "Guardar serie" }).click();
  await expect(
    seriesPage.getByRole("heading", { name: "Draft survives" }),
  ).toBeVisible();
  const completedPlay = records.splice(1, 1)[0];
  await page.reload();
  await seriesPage
    .getByRole("button", { name: "Abrir Draft survives" })
    .click();
  await expect(
    seriesPage.getByText("0 de 2 juegos terminados", { exact: true }),
  ).toBeVisible();
  await expect(
    seriesPage.getByText("Siguiente: Juego no disponible", { exact: true }),
  ).toBeVisible();
  expect(state.series[0].gameIds).toHaveLength(2);
  records.push(completedPlay);
  records[0].status = "remembered";
  await page.reload();
  await seriesPage
    .getByRole("button", { name: "Abrir Draft survives" })
    .click();
  await expect(
    seriesPage.getByText("2 de 2 juegos terminados", { exact: true }),
  ).toBeVisible();
  await expect(
    seriesPage.getByText("Serie completada", { exact: true }),
  ).toBeVisible();
  await seriesPage.getByRole("button", { name: "Editar serie" }).click();
  page.once("dialog", (d) => d.accept());
  await seriesPage.getByRole("button", { name: "Eliminar serie" }).click();
  await expect(
    seriesPage.getByText(
      "Creá una serie y agregá juegos en el orden que quieras.",
    ),
  ).toBeVisible();
  await page.goto("./?tab=journal&year=all");
  await expect(
    page.locator(".mobile-games").getByText("Game A", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".mobile-games").getByText("Game B", { exact: true }),
  ).toBeVisible();
});
