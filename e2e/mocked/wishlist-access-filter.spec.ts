import { expect, test } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

test("filters wishlist access by normalized categories and resets it for global search results", async ({
  page,
}) => {
  const records = [
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000001",
      gameId: "20000000-0000-4000-8000-000000000001",
      title: "Comprado A",
      status: "wishlist" as const,
      ownership: " Sí ",
      device: "PC",
    },
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000002",
      gameId: "20000000-0000-4000-8000-000000000002",
      title: "Sin comprar B",
      status: "wishlist" as const,
      ownership: "no",
      device: "PC",
    },
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000003",
      gameId: "20000000-0000-4000-8000-000000000003",
      title: "Familiar C",
      status: "wishlist" as const,
      ownership: " Familia ",
      device: "PC",
    },
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000004",
      gameId: "20000000-0000-4000-8000-000000000004",
      title: "Desconocido D",
      status: "wishlist" as const,
      ownership: "Pendiente",
      device: "PC",
    },
  ];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records")
      return route.fulfill({
        json: { records, member: { display_name: "Fixture", role: "member" } },
      });
    if (url.pathname === "/api/notifications")
      return route.fulfill({
        json: {
          items: [],
          unreadCount: 0,
          nextCursor: null,
          checkedAt: new Date().toISOString(),
        },
      });
    return route.fulfill({
      json:
        url.pathname === "/api/sharing"
          ? { shared: [], members: [], grants: [] }
          : [],
    });
  });

  await page.goto("./?tab=wishlist");
  await expect(
    page.getByRole("button", { name: "Ver detalles de Comprado A" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver detalles de Sin comprar B" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver detalles de Familiar C" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver detalles de Desconocido D" }),
  ).toBeVisible();

  await page.locator("details.notebook-view-filters > summary").click();
  const access = page.getByLabel("Filtrar acceso");
  await expect(access).toHaveValue("");
  await expect(access.locator("option")).toHaveText([
    "Todos los accesos",
    "Comprado",
    "Sin comprar",
    "Acceso familiar",
  ]);
  await access.selectOption("owned");
  await expect(page).toHaveURL(/access=owned/);
  await expect(
    page.getByRole("button", { name: "Ver detalles de Comprado A" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver detalles de Sin comprar B" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ver detalles de Desconocido D" }),
  ).toHaveCount(0);

  await access.selectOption("not-owned");
  await page.goBack();
  await expect(access).toHaveValue("owned");
  await page.goForward();
  await expect(access).toHaveValue("not-owned");
  await page.reload();
  await page.locator("details.notebook-view-filters > summary").click();
  await expect(page.getByLabel("Filtrar acceso")).toHaveValue("not-owned");
  await page.getByLabel("Filtrar acceso").selectOption("family");
  await expect(
    page.getByRole("button", { name: "Ver detalles de Familiar C" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver detalles de Comprado A" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ver detalles de Desconocido D" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("1 filtros activos")).toBeVisible();
  await page.screenshot({
    path: "test-results/wishlist-access-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Buscar juegos en esta lista").fill("Comprado A");
  await expect(
    page.getByRole("button", { name: "Ver detalles de Familiar C" }),
  ).toHaveCount(0);
  await page.getByLabel("Buscar juegos en esta lista").fill("");
  await expect(
    page.getByRole("button", { name: "Ver detalles de Familiar C" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Buscar en todos mis juegos" })
    .click();
  await page
    .getByRole("searchbox", { name: "Buscar en todos mis juegos" })
    .fill("Comprado A");
  await page
    .getByRole("button", {
      name: /Abrir partida · Comprado A · Lista de deseos · PC/,
    })
    .click();
  await expect(page).toHaveURL(/tab=wishlist/);
  expect(new URL(page.url()).searchParams.has("access")).toBe(false);
  await expect(
    page.getByRole("button", { name: "Ver detalles de Comprado A" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const filters = page.locator("details.notebook-view-filters");
  if (
    !(await filters.evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await filters.locator("> summary").click();
  await page.getByLabel("Filtrar acceso").selectOption("owned");
  await expect(
    page.getByRole("article").filter({ hasText: "Comprado A" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("article").filter({ hasText: "Sin comprar B" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("article").filter({ hasText: "Familiar C" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("article").filter({ hasText: "Desconocido D" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/wishlist-access-mobile.png",
    fullPage: true,
  });
});
