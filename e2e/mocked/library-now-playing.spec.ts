import { expect, test } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

test("Jugando ahora selects privately, opens the playthrough and respects dirty drafts", async ({
  page,
}, testInfo) => {
  const firstImpression = "Me quedé a escuchar la música después del final.";
  const wideCoverTitle = "La montaña azul y la expedición al otro lado del glaciar";
  const records = [
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000061",
      title: "Final Fantasy VI",
      status: "completed",
      finished: "2026-10-16",
      impression: firstImpression,
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/pinned-faro.jpg",
      },
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000062",
      title: wideCoverTitle,
      status: "playing",
      cover: {
        provider: "nintendo",
        providerUrl: "https://assets.nintendo.com/image/upload/pinned-montana.jpg",
      },
    },
  ];
  let memberId = "10000000-0000-4000-8000-000000000001";
  let availableRecords = records;
  let holdPortraitSample: Promise<void> | undefined;
  await page.route("https://assets.nintendo.com/**/pinned-faro.jpg", async (route) => {
    if (route.request().headers().origin) {
      await holdPortraitSample;
      return route.fulfill({
        contentType: "image/png",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNQTV9DEmIY1TCqYfhqAABYAzgQSY8ahQAAAABJRU5ErkJggg==", "base64"),
      });
    }
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#223957"/><stop offset="1" stop-color="#977583"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h300v400H0z"/><circle fill="#f0cf96" cx="195" cy="113" r="32"/><path fill="#243543" d="m0 319 97-92 74 36 129 22v115H0z"/><path fill="#d9d0be" d="m85 234 8-83h16l7 91z"/><path fill="#efbc74" d="M92 151h18v-12H92z"/></svg>',
    });
  });
  await page.route("https://assets.nintendo.com/**/pinned-montana.jpg", (route) => {
    if (route.request().headers().origin) {
      return route.fulfill({
        contentType: "image/png",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: "Invalid image bytes",
      });
    }
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 240"><path fill="#131f30" d="M0 0h620v240H0z"/><path fill="#294c62" d="m0 170 142-103 119 71 141-99 218 140v61H0z"/><text x="310" y="130" text-anchor="middle" fill="#fff4db" font-family="Georgia" font-size="56">LA MONTAÑA AZUL</text></svg>',
    });
  });
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/records") {
      return route.fulfill({
        json: {
          records: availableRecords,
          member: { id: memberId, display_name: "Fixture", role: "member" },
        },
      });
    }
    if (pathname === "/api/sharing") {
      return route.fulfill({ json: { shared: [], members: [], grants: [] } });
    }
    if (pathname === "/api/notifications") {
      return route.fulfill({
        json: {
          items: [],
          unreadCount: 0,
          nextCursor: null,
          checkedAt: new Date().toISOString(),
        },
      });
    }
    if (pathname === "/api/backups") {
      const checkedAt = new Date().toISOString();
      const lastSuccess = { id: "fixture", status: "succeeded", completed_at: checkedAt };
      return route.fulfill({ json: { checkedAt, lastSuccess, latest: lastSuccess } });
    }
    if (pathname === "/api/backups/drive") {
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
    }
    return route.fulfill({ json: [] });
  });

  const dialog = page.getByRole("dialog", { name: "Personalizar Jugando ahora" });
  const manage = page.getByRole("button", { name: "Personalizar Jugando ahora", exact: true });
  const feature = page.getByRole("button", { name: "Mostrar como «Jugando ahora»" });
  const shortcut = page.getByRole("button", { name: /^Jugando ahora / });
  const back = page.getByRole("button", { name: "← Biblioteca" });
  const playthrough = page.getByRole("region", { name: "Detalle del juego" });
  const sidebar = page.getByRole("complementary");
  const topbar = page.locator(".topbar");
  const brand = { name: /Game Journal/ };
  const search = page.getByRole("button", { name: "Buscar en todos mis juegos" });
  const activeDesktop = page.getByRole("navigation", { name: "Navegación principal" }).locator("[aria-current=page]");
  await page.goto("./?tab=library&year=all");
  const originalNav = await activeDesktop.evaluate((node) => getComputedStyle(node).backgroundColor);
  await expect(shortcut).toHaveCount(0);
  await expect(sidebar.getByRole("link", brand)).toBeVisible();
  await expect(topbar.getByRole("link", brand)).toHaveCount(0);
  await expect(search.getByText("Buscar en todos mis juegos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver detalles de Final Fantasy VI" }).click();
  await feature.click();
  await expect(shortcut).toHaveAccessibleName("Jugando ahora Final Fantasy VI");
  await expect(topbar.getByRole("button", { name: /^Jugando ahora / })).toBeVisible({ timeout: 1500 });
  await expect(sidebar.getByRole("link", brand)).toBeVisible();
  await expect(topbar.getByRole("link", brand)).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expect(shortcut.getByText("Jugando ahora", { exact: true })).toBeVisible();
  await expect(shortcut.getByText("Final Fantasy VI", { exact: true })).toBeVisible();
  await expect(playthrough.getByText("Terminado", { exact: true })).toBeVisible();
  await expect(activeDesktop).not.toHaveCSS("background-color", originalNav);
  await manage.click();
  await expect(dialog.getByRole("group", { name: "Vista previa del encabezado" })).toBeVisible();
  await expect(dialog.getByLabel("Color personalizado")).toHaveValue("#2567ac");
  await dialog.getByRole("button", { name: "Personalizar colores del diario" }).click();
  const paletteDialog = page.getByRole("dialog", { name: "Colores del diario" });
  await paletteDialog.getByRole("button", { name: "Bosque", exact: true }).click();
  await paletteDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog.getByLabel("Color personalizado")).toHaveValue("#2567ac");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(manage).toBeFocused();

  await back.click();
  for (const [width, capture] of [[1280, "desktop"], [900, "compact"], [800, "narrow"]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(topbar.getByRole("button", { name: /^Jugando ahora / })).toBeVisible();
    await expect(sidebar.getByRole("link", brand)).toBeVisible();
    await expect(search.getByText("Buscar en todos mis juegos", { exact: true })).toBeHidden();
    await expect(search.getByText("Ctrl K", { exact: true })).toBeHidden();
    await expect(search).toBeVisible();
    const gameBounds = (await shortcut.boundingBox())!;
    const searchBounds = (await search.boundingBox())!;
    expect(searchBounds.x).toBeGreaterThanOrEqual(gameBounds.x + gameBounds.width);
    expect(Math.abs(searchBounds.y + searchBounds.height / 2 - (gameBounds.y + gameBounds.height / 2))).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`jugando-ahora-${capture}.png`), animations: "disabled" });
  }
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Buscar en todos mis juegos" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: `Ver detalles de ${wideCoverTitle}` }).click();
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  const scale = page.getByRole("combobox", { name: "Escala de producción", exact: true });
  await scale.selectOption("indie");
  await shortcut.click();
  await expect(scale).toHaveValue("indie");
  expect(new URL(page.url()).searchParams.get("detail")).toBe(records[1].id);
  await expect(page.getByText("Guardá o cancelá la edición antes de salir de la ficha.")).toBeVisible();
  await back.click();
  await page.getByRole("button", { name: "Descartar cambios", exact: true }).click();

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Próximos" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Próximos" })).toBeVisible();
  await shortcut.click();
  await expect(playthrough).toContainText("Final Fantasy VI");
  await expect(back).toBeFocused();
  await back.click();

  const originalMember = memberId;
  memberId = "10000000-0000-4000-8000-000000000002";
  await page.goto("./?tab=library&year=all");
  await expect(page.getByRole("table").getByText(wideCoverTitle, { exact: true })).toBeVisible();
  await expect(shortcut).toHaveCount(0);
  memberId = originalMember;

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(shortcut).toHaveAccessibleName("Jugando ahora Final Fantasy VI");
  await expect(topbar.getByRole("link", brand)).toHaveCount(0, { timeout: 1500 });
  await expect(search.getByText("Buscar en todos mis juegos", { exact: true })).toBeHidden();
  await expect(search).toBeVisible();
  await expect(topbar.getByRole("button", { name: /^Jugando ahora / })).toBeVisible();
  await expect(manage).toHaveCount(0);
  await topbar.screenshot({ path: testInfo.outputPath("jugando-ahora-mobile-dark.png"), animations: "disabled" });
  await page.getByRole("navigation", { name: "Navegación móvil" }).getByRole("button", { name: "Más", exact: true }).click();
  await expect(sidebar.getByRole("link", brand)).toBeVisible();
  await sidebar.getByRole("button", { name: "Cerrar menú" }).click();
  await page.evaluate(() => document.documentElement.classList.add("light"));
  await page.getByRole("button", { name: `Editar rápidamente ${wideCoverTitle}` }).click();
  await feature.click();
  await expect(shortcut).toHaveAccessibleName(`Jugando ahora ${wideCoverTitle}`);
  await expect(shortcut.getByText(wideCoverTitle, { exact: true })).toBeVisible();
  await manage.click();
  await expect(dialog.getByLabel("Color personalizado")).toHaveValue("#a46b32");
  await dialog.getByRole("button", { name: "Verde", exact: true }).click();
  await dialog.getByRole("button", { name: "Aplicar" }).click();
  await expect(manage).toBeFocused();
  await back.click();
  await expect(page.getByRole("button", { name: `Editar rápidamente ${wideCoverTitle}` })).toBeFocused();
  const mobileTitle = shortcut.getByText(wideCoverTitle, { exact: true });
  const notebook = topbar.getByRole("button", { name: "Abrir cuaderno" });
  const notifications = topbar.getByRole("button", { name: "Ver notificaciones" });
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(shortcut).toHaveAccessibleName(`Jugando ahora ${wideCoverTitle}`);
    await expect(mobileTitle).toHaveCSS("text-overflow", "ellipsis");
    const bounds = (await shortcut.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    let right = bounds.x + bounds.width;
    for (const control of [search, notebook, notifications]) {
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(right - 1);
      expect(Math.abs(box.y + box.height / 2 - (bounds.y + bounds.height / 2))).toBeLessThanOrEqual(1);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      right = box.x + box.width;
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await topbar.screenshot({ path: testInfo.outputPath("jugando-ahora-mobile-light.png"), animations: "disabled" });

  await shortcut.click();
  await expect(playthrough).toContainText(wideCoverTitle);
  await manage.click();
  await dialog.getByRole("button", { name: "Quitar de Jugando ahora" }).click();
  await expect(shortcut).toHaveCount(0);
  await expect(feature).toBeFocused();
  await page.reload();
  await expect(back).toBeVisible();
  await expect(shortcut).toHaveCount(0);
  await expect(search.getByText("Buscar en todos mis juegos", { exact: true })).toBeVisible();

  await back.click();
  let finishPortraitSample!: () => void;
  holdPortraitSample = new Promise((resolve) => { finishPortraitSample = resolve; });
  await page.getByRole("button", { name: "Editar rápidamente Final Fantasy VI" }).click();
  const sampling = page.waitForRequest((request) => request.url().endsWith("pinned-faro.jpg") && !!request.headers().origin);
  await feature.click();
  const sampleRequest = await sampling;
  const samplingAborted = page.waitForEvent("requestfailed", (request) => request === sampleRequest);
  await manage.click();
  await dialog.getByRole("button", { name: "Quitar de Jugando ahora" }).click();
  await samplingAborted;
  finishPortraitSample();
  holdPortraitSample = undefined;
  await expect(shortcut).toHaveCount(0);

  await page.evaluate(({ key, id }) => localStorage.setItem(key, id), {
    key: `journal-library-cover:${originalMember}`,
    id: records[0].id,
  });
  await page.reload();
  await expect(shortcut).toHaveAccessibleName("Jugando ahora Final Fantasy VI");
  availableRecords = records.slice(1);
  await page.goto("./?tab=library&year=all");
  await expect(page.getByRole("heading", { name: wideCoverTitle })).toBeVisible();
  await expect(shortcut).toHaveCount(0);
});
