import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { emptyRecord } from "../../src/lib/types";

test("creates and downloads a curated monthly recap with an opt-in note", async ({
  page,
}) => {
  const records = [
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000001",
      gameId: "20000000-0000-4000-8000-000000000001",
      title: "A memorable journey",
      status: "completed" as const,
      started: "2026-04-30",
      finished: "2026-05-02",
      cover: { providerUrl: "https://images.ctfassets.net/game/cover.png" },
    },
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000002",
      gameId: "20000000-0000-4000-8000-000000000002",
      title: "Another adventure",
      status: "completed" as const,
      finished: "2026-05-17",
    },
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000004",
      gameId: "20000000-0000-4000-8000-000000000004",
      title: "Older completion",
      status: "completed" as const,
      finished: "2021-08-01",
    },
    {
      ...emptyRecord,
      id: "10000000-0000-4000-8000-000000000003",
      title: "Year only",
      status: "completed" as const,
      finished: "2026",
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
  await page.route("https://images.ctfassets.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="600"><rect width="420" height="600" fill="#4c6a54"/><circle cx="210" cy="190" r="110" fill="#d9b26b"/><path d="M40 520 170 310l90 140 65-80 55 150" fill="#23382c"/><text x="28" y="570" fill="white" font-size="28">GAME COVER</text></svg>',
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("journal-theme", "light"),
  );
  await page.goto("./?tab=statistics");
  await page.getByRole("button", { name: "Estadísticas", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear resumen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resumen mensual", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Año del resumen").selectOption("2021");
  await page.getByLabel("Año del resumen").selectOption("2026");
  await page.getByLabel("Mes del resumen").selectOption("5");
  await expect(
    page.getByText("2 partidas terminadas", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/1 partida terminada excluida por fecha/, { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Período").selectOption("year");
  await expect(
    page.getByRole("heading", { name: "Resumen anual", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 partidas terminadas", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Período").selectOption("month");
  await expect(
    page.getByRole("heading", { name: "Resumen mensual", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 partidas terminadas", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Juego destacado")
    .selectOption("20000000-0000-4000-8000-000000000001");
  await page.getByLabel("Nota (opcional)").fill("Un recuerdo especial");
  await expect(
    page.getByRole("img", { name: "Vista previa del resumen" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/recap-preview-desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("img", { name: "Vista previa del resumen" }),
  ).toHaveAttribute("src", /^blob:/);
  await expect(
    page.getByRole("button", { name: "Descargar PNG", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("checkbox", {
      name: "Incluir la nota en este PNG",
      exact: true,
    }),
  ).not.toBeChecked();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar PNG", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  await download.saveAs(
    join(process.cwd(), "test-results/recap-export-light.png"),
  );
  await expect(
    page.getByRole("checkbox", {
      name: "Incluir la nota en este PNG",
      exact: true,
    }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: "Incluir la nota en este PNG", exact: true })
    .check();
  await expect(
    page.getByRole("img", { name: "Vista previa del resumen" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const lightPreview = await page
    .getByRole("img", { name: "Vista previa del resumen" })
    .getAttribute("src");
  await page.evaluate(() => document.documentElement.classList.remove("light"));
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Vista previa del resumen" })
        .getAttribute("src"),
    )
    .not.toBe(lightPreview);
  await expect(
    page.getByRole("heading", { name: "Resumen mensual", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/recap-preview-mobile-dark.png",
    fullPage: true,
  });
  const darkDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar PNG", exact: true })
    .click();
  const darkDownload = await darkDownloadPromise;
  await darkDownload.saveAs(
    join(process.cwd(), "test-results/recap-export-dark.png"),
  );
  await expect(
    page.getByRole("checkbox", {
      name: "Incluir la nota en este PNG",
      exact: true,
    }),
  ).not.toBeChecked();
});

test("a cover with failed cross-origin loading falls back without blocking PNG export", async ({
  page,
}) => {
  const record = {
    ...emptyRecord,
    id: "10000000-0000-4000-8000-000000000011",
    gameId: "20000000-0000-4000-8000-000000000011",
    title: "Cover fallback",
    status: "completed" as const,
    finished: "2026-05-02",
    cover: { providerUrl: "https://images.ctfassets.net/game/no-cors.png" },
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records")
      return route.fulfill({
        json: {
          records: [record],
          member: { display_name: "Fixture", role: "member" },
        },
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
    return route.fulfill({ json: [] });
  });
  await page.route("https://images.ctfassets.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: "broken-image",
    }),
  );
  await page.goto("./?tab=statistics");
  await page.getByRole("button", { name: "Estadísticas", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear resumen", exact: true })
    .click();
  await page.getByLabel("Año del resumen").selectOption("2026");
  await page.getByLabel("Mes del resumen").selectOption("5");
  await page.getByLabel("Juego destacado").selectOption(record.gameId);
  await expect(
    page.getByRole("img", { name: "Vista previa del resumen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar PNG", exact: true }),
  ).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar PNG", exact: true })
    .click();
  const download = await downloadPromise;
  const exportPath = join(
    process.cwd(),
    "test-results/recap-export-fallback.png",
  );
  await download.saveAs(exportPath);
  const png = await readFile(exportPath);
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1350);
});

test("does not offer a recap download when the first owner-record load fails", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return url.pathname === "/api/records"
      ? route.fulfill({ status: 503, json: { error: "unavailable" } })
      : route.fulfill({ json: [] });
  });
  await page.goto("./?tab=statistics");
  await page.getByRole("button", { name: "Estadísticas", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear resumen", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No se pudieron cargar tus partidas",
  );
  await expect(
    page.getByRole("button", { name: "Descargar PNG", exact: true }),
  ).toHaveCount(0);
});
