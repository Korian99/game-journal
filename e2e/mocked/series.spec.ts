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
      status: "completed",
      finished: "2026-01-01",
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000002",
      gameId: "10000000-0000-4000-8000-000000000002",
      title: "Game B",
      status: "completed",
      finished: "2026-01-02",
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
  await page.getByRole("button", { name: "Series", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Series" });
  await dialog.getByRole("button", { name: "Crear serie" }).click();
  await dialog.getByLabel("Nombre").fill("My saga");
  await dialog
    .getByLabel("Buscar juegos para agregar a la serie")
    .fill("Game A");
  await dialog
    .getByLabel("Agregar juego")
    .selectOption("10000000-0000-4000-8000-000000000001");
  await dialog
    .getByLabel("Buscar juegos para agregar a la serie")
    .fill("Game B");
  await dialog
    .getByLabel("Agregar juego")
    .selectOption("10000000-0000-4000-8000-000000000002");
  await dialog.getByRole("button", { name: "Mover Game B arriba" }).click();
  await dialog.getByRole("button", { name: "Guardar serie" }).click();
  await expect(dialog.getByRole("heading", { name: "My saga" })).toBeVisible();
  expect(state.series[0].gameIds).toEqual([
    records[1].gameId,
    records[0].gameId,
  ]);
  await page.screenshot({
    path: "test-results/series-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Series", exact: true }).click();
  await dialog.getByRole("button", { name: "Editar serie" }).click();
  await expect(dialog.locator("ol li span")).toHaveText(["Game B", "Game A"]);
  await dialog.getByLabel("Nombre").fill("Updated saga");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/series-mobile.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Guardar serie" }).click();
  expect(state.series[0].name).toBe("Updated saga");
  state.failSaves = 1;
  await dialog.getByRole("button", { name: "Editar serie" }).click();
  await dialog.getByLabel("Nombre").fill("Draft survives");
  await dialog.getByRole("button", { name: "Guardar serie" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Nombre")).toHaveValue("Draft survives");
  await dialog.getByRole("button", { name: "Guardar serie" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Draft survives" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Editar serie" }).click();
  page.once("dialog", (d) => d.accept());
  await dialog.getByRole("button", { name: "Eliminar serie" }).click();
  await expect(
    dialog.getByText("Creá una serie y agregá juegos en el orden que quieras."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByRole("heading", { name: "Game A", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Game B", exact: true })).toBeVisible();
});
