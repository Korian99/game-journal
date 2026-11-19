import { expect, test, type Locator, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyRecord } from "../../src/lib/types";
import { mockMemberAppearance } from "./mock-member-appearance";

const views = [
  ["library", "Biblioteca"],
  ["journal", "Biblioteca"],
  ["wishlist", "Lista de deseos"],
  ["upcoming", "Próximos"],
  ["suggestions", "¿Qué juego ahora?"],
  ["statistics", "Estadísticas"],
  ["shared", "Compartido conmigo"],
  ["settings", "Configuración"],
] as const;

test("appearance settings apply and persist both notebook palettes", async ({
  page,
}) => {
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=settings");

  const lightButton = page.getByRole("button", { name: "Claro", exact: true });
  const darkButton = page.getByRole("button", { name: "Oscuro", exact: true });
  const shell = page.locator(".app-shell.notebook-app");
  await expect(lightButton).toBeVisible();
  await lightButton.click();
  await expect(lightButton).toHaveAttribute("aria-pressed", "true");
  await expect(shell).toHaveCSS("--bg", "#ede5d8");
  await expect(shell).toHaveCSS("--surface", "#f5eee3");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(237, 229, 216)",
  );
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-settings-light-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-settings-preview.png"),
    fullPage: false,
    animations: "disabled",
  });

  await page.reload();
  await expect(lightButton).toHaveAttribute("aria-pressed", "true");
  await page.goto("./?tab=library");
  await expect(shell).toHaveCSS("--bg", "#ede5d8");
  await page.locator(".notebook-library-add").click();
  const editor = page.locator(".modal-content");
  await expect(editor).toHaveCSS("--surface", "#f5eee3");
  await expect(editor).toHaveCSS("color", "rgb(51, 42, 33)");
  await page.keyboard.press("Escape");
  await page.goto("./?tab=settings");

  await darkButton.click();
  await expect(darkButton).toHaveAttribute("aria-pressed", "true");
  await expect(shell).toHaveCSS("--bg", "#222326");
  await expect(shell).toHaveCSS("--surface", "#2b2c30");
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-settings-dark-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  for (const [theme, button] of [
    ["dark", darkButton],
    ["light", lightButton],
  ] as const) {
    await button.click();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390) {
        await page.screenshot({
          path: join(tmpdir(), `notebook-theme-settings-${theme}-390.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
});

test("yearly library summary stays readable across themes and viewports", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("journal-theme", "dark"));
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");

  const shell = page.locator(".app-shell.notebook-app");
  const disclosure = page.locator(".notebook-library-summary");
  const summary = disclosure.locator(".collection-summary");
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveJSProperty("open", true);
  await expect(summary.locator('[data-stat="total"] strong')).toHaveText("2");
  await expect(
    summary.getByRole("heading", { name: "Juegos por consola" }),
  ).toBeVisible();
  await disclosure.screenshot({
    path: join(tmpdir(), "notebook-year-summary-dark-desktop.png"),
    animations: "disabled",
  });

  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveJSProperty("open", false);
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveJSProperty("open", true);

  for (const width of [1280, 640, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const statRows = await summary
      .locator(".filtered-stats > div")
      .evaluateAll((elements) =>
        elements.slice(0, 3).map((element) => {
          const { x, y } = element.getBoundingClientRect();
          return { x, y };
        }),
      );
    expect(statRows[0]?.y).toBe(statRows[1]?.y);
    if (width > 600) expect(statRows[1]?.y).toBe(statRows[2]?.y);
    else expect(statRows[2]?.y).toBeGreaterThan(statRows[1]?.y ?? 0);
    const dimensions = await summary.evaluate((element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.page).toBeLessThanOrEqual(width);
    if (width === 390 || width === 360)
      await disclosure.screenshot({
        path: join(tmpdir(), `notebook-year-summary-dark-${width}.png`),
        animations: "disabled",
      });
  }

  await page.evaluate(() => {
    document.documentElement.classList.add("light");
    localStorage.setItem("journal-theme", "light");
  });
  await expect(shell).toHaveCSS("--bg", "#ede5d8");
  await page.setViewportSize({ width: 1280, height: 900 });
  await disclosure.screenshot({
    path: join(tmpdir(), "notebook-year-summary-light-desktop.png"),
    animations: "disabled",
  });

  for (const width of [1280, 640, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const statRows = await summary
      .locator(".filtered-stats > div")
      .evaluateAll((elements) =>
        elements.slice(0, 3).map((element) => {
          const { x, y } = element.getBoundingClientRect();
          return { x, y };
        }),
      );
    expect(statRows[0]?.y).toBe(statRows[1]?.y);
    if (width > 600) expect(statRows[1]?.y).toBe(statRows[2]?.y);
    else expect(statRows[2]?.y).toBeGreaterThan(statRows[1]?.y ?? 0);
    const dimensions = await summary.evaluate((element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.page).toBeLessThanOrEqual(width);
    if (width === 390 || width === 360)
      await disclosure.screenshot({
        path: join(tmpdir(), `notebook-year-summary-light-${width}.png`),
        animations: "disabled",
      });
  }
});

test("playing row highlight uses the shared olive accent in both themes", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("journal-theme", "light"),
  );
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");

  const shell = page.locator(".app-shell.notebook-app");
  const row = page.locator(".library-table .library-playing");
  const rowStripe = row.locator("td:first-child");
  const completed = page
    .locator(".library-table tbody tr")
    .filter({ hasText: "Theme fixture" });
  await expect(shell).toHaveCSS("--accent", "#a46b32");
  await expect(shell).toHaveCSS("--collection-highlight", "#a4a432");
  await page.locator(".notebook-library-add").click();
  await expect(page.locator(".modal-content")).toHaveCSS("--accent", "#a46b32");
  await page.keyboard.press("Escape");

  const lightRowStyles = await row.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor };
  });
  expect(
    await rowStripe.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toContain("164, 164, 50");
  expect(lightRowStyles.background).not.toBe(
    await shell.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
  const completedShadow = await completed.evaluate(
    (element) =>
      getComputedStyle(element.querySelector("td:first-child")!).boxShadow,
  );
  expect(completedShadow).not.toContain("164, 164, 50");
  await row.screenshot({
    path: join(tmpdir(), "notebook-playing-highlight-light-row.png"),
    animations: "disabled",
  });
  await page.screenshot({
    path: join(tmpdir(), "notebook-playing-highlight-light-library.png"),
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileRow = page.locator(
    ".notebook-entry-card.library-playing:not(.notification-highlight)",
  );
  await expect(mobileRow).toBeVisible();
  expect(
    await mobileRow.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toContain("164, 164, 50");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await mobileRow.screenshot({
    path: join(tmpdir(), "notebook-playing-highlight-light-390.png"),
    animations: "disabled",
  });

  await page.evaluate(() => {
    document.documentElement.classList.remove("light");
    localStorage.setItem("journal-theme", "dark");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(shell).toHaveCSS("--accent", "#c4a25a");
  const darkShadow = await rowStripe.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(darkShadow).toContain("164, 164, 50");
  await page.setViewportSize({ width: 390, height: 844 });
  const darkMobileShadow = await mobileRow.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(darkMobileShadow).not.toContain("164, 164, 50");
});

test("Biblioteca edits open a grouped book page and return to the list", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("journal-library-layout", "notebook");
    localStorage.setItem("journal-theme", "light");
  });
  await mockApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?tab=library");

  await expect(page.getByRole("group", { name: "Vista de Biblioteca" })).toHaveCount(0);
  const listEdit = page.locator(".notebook-entry-card")
    .filter({ hasText: "Theme fixture" })
    .getByRole("button", { name: "Editar rápidamente Theme fixture" });
  await listEdit.click();
  await expect(page.locator(".library-notebook-page")).toContainText("Theme fixture");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: join(tmpdir(), "notebook-detail-mobile-light.png"), fullPage: true, animations: "disabled" });
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Escala de producción", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "← Biblioteca", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  await expect(page.locator(".notebook-entry-card").filter({ hasText: "Theme fixture" })).toBeVisible();
  await expect(page.locator(".library-notebook-page")).toHaveCount(0);
  await page.evaluate(() => { document.documentElement.classList.remove("light"); localStorage.setItem("journal-theme", "dark"); });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator(".library-table").getByRole("button", { name: "Ver detalles de Theme fixture", exact: true }).click();
  await page.screenshot({ path: join(tmpdir(), "notebook-detail-desktop-dark.png"), fullPage: true, animations: "disabled" });
  await expect(page.getByRole("button", { name: "← Biblioteca", exact: true })).toBeVisible();
});

test("book pages keep the full draft through save and guard dirty inline edits", async ({ page }) => {
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");
  await page.locator(".library-table").getByRole("button", { name: "Ver detalles de Theme fixture", exact: true }).click();
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await page.getByRole("combobox", { name: "Escala de producción", exact: true }).selectOption("indie");
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Guardar entrada", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Escala de producción", exact: true })).toHaveValue("indie");
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.getByRole("button", { name: "Editar Nombre de Theme fixture" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Theme draft");
  await expect(page.getByRole("tab", { name: "Más", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre" })).toHaveValue("Theme draft");
  await page.getByRole("button", { name: "Cancelar celda" }).click();
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await page.getByRole("combobox", { name: "Escala de producción", exact: true }).selectOption("aa");
  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Descartar cambios" })).toBeVisible();
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(page.getByRole("combobox", { name: "Escala de producción", exact: true })).toHaveValue("aa");
  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  await page.getByRole("button", { name: "Descartar cambios", exact: true }).click();
  await expect(page.locator(".library-table")).toContainText("Theme fixture");
  await expect(page.locator(".library-table").getByRole("button", { name: "Ver detalles de Theme fixture", exact: true })).toBeFocused();
});

test("book principal and more pages keep moved fields and the modal editor stays complete", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("journal-theme", "dark"));
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");
  await page.locator(".library-table").getByRole("button", { name: "Ver detalles de Theme fixture", exact: true }).click();

  const summary = page.getByRole("tabpanel", { name: "Resumen" });
  await expect(summary.getByRole("button", { name: "Editar Nombre de Theme fixture" })).toBeVisible();
  await expect(summary.getByRole("button", { name: "Editar Comentarios adicionales de Theme fixture" })).toBeVisible();

  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  const main = page.getByRole("tabpanel", { name: "Principal" });
  const guide = page.getByRole("button", { name: "Guía de reseñas", exact: true });
  const back = page.getByRole("button", { name: "← Biblioteca", exact: true });
  await expect(guide).toBeVisible();
  const guideBox = (await guide.boundingBox())!;
  const backBox = (await back.boundingBox())!;
  expect(guideBox.x).toBeGreaterThan(backBox.x + backBox.width);
  await expect(main.getByRole("textbox", { name: "Historia, gameplay o ambos", exact: true })).toBeVisible();
  await expect(main.getByRole("textbox", { name: "¿Lo rejugarías?", exact: true })).toBeVisible();
  await expect(main.getByRole("combobox", { name: "Hype", exact: true })).toBeVisible();
  await expect(main.getByRole("textbox", { name: "Nombre del juego", exact: true })).toHaveCount(0);
  await expect(main.getByRole("combobox", { name: "Estado", exact: true })).toHaveCount(0);
  await expect(main.getByRole("textbox", { name: "Horas estimadas", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Secciones del juego" }).getByRole("tab")).toHaveCount(3);
  await expect(page.getByRole("tab", { name: "Partida", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Reseña", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar entrada", exact: true })).toBeVisible();
  await page.screenshot({ path: join(tmpdir(), "notebook-extra-principal-desktop-dark.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.add("light"); localStorage.setItem("journal-theme", "light"); });
  await page.screenshot({ path: join(tmpdir(), "notebook-extra-principal-mobile-light.png"), fullPage: true, animations: "disabled" });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const mobileBack = (await back.boundingBox())!;
  const mobileGuide = (await guide.boundingBox())!;
  expect(mobileGuide.y + mobileGuide.height / 2).toBeCloseTo(mobileBack.y + mobileBack.height / 2, 0);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);
  await page.screenshot({ path: join(tmpdir(), "notebook-extra-summary-mobile-light.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("tab", { name: "Principal", exact: true }).click();
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  const more = page.getByRole("tabpanel", { name: "Más" });
  await expect(more.getByRole("textbox", { name: "¿Lo rejugarías?", exact: true })).toHaveCount(0);
  await expect(more.getByRole("combobox", { name: "Hype", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar entrada", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.locator(".entry-editor-actions")).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=wishlist");
  await page.locator(".wishlist-table").getByRole("button", { name: "Ver detalles de Wishlist fixture", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Tu partida", exact: true });
  await expect(modal.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Cerrar", exact: true })).toBeVisible();
  await expect(modal.getByRole("textbox", { name: "Nombre del juego", exact: true })).toBeVisible();
  await expect(modal.getByRole("tab", { name: "Partida", exact: true })).toBeVisible();
  await expect(modal.getByRole("tab", { name: "Reseña", exact: true })).toBeVisible();
  await modal.getByRole("tab", { name: "Reseña", exact: true }).click();
  await expect(modal.getByRole("textbox", { name: "Historia, gameplay o ambos", exact: true })).toBeVisible();
  await modal.getByRole("tab", { name: "Más", exact: true }).click();
  await expect(modal.getByRole("textbox", { name: "¿Lo rejugarías?", exact: true })).toBeVisible();
  await expect(modal.getByRole("combobox", { name: "Hype" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);

  const options = modal.getByRole("button", { name: "Opciones del juego" });
  await options.click();
  await modal.getByRole("button", { name: "Eliminar entrada", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Eliminar entrada" });
  const returnToEditor = confirmation.getByRole("button", { name: "Volver al editor", exact: true });
  await expect(returnToEditor).toBeFocused();
  await expect(confirmation.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);
  await returnToEditor.click();
  await expect(options).toBeFocused();
});

test("a private next-session reminder persists without replacing review comments", async ({ page }) => {
  await mockApp(page, false, true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");
  const openBook = () => page.locator(".library-table").getByRole("button", { name: "Ver detalles de Theme fixture", exact: true });
  await openBook().click();
  const reminder = page.locator(".library-notebook-reminder");
  const comments = page.locator(".library-notebook-notes");
  await expect(reminder).toContainText("Agregar recordatorio");
  await expect(comments).toContainText("Existing review comment");
  await page.getByRole("button", { name: "Editar Notas de Theme fixture", exact: true }).click();
  await page.getByRole("textbox", { name: "Notas", exact: true }).fill("Try another route next time");
  await page.getByRole("button", { name: "Guardar celda" }).click();
  await expect(reminder).toContainText("Try another route next time");
  await expect(comments).toContainText("Existing review comment");

  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  await page.reload();
  await openBook().click();
  await expect(page.locator(".library-notebook-reminder")).toContainText("Try another route next time");
  await expect(page.locator(".library-notebook-notes")).toContainText("Existing review comment");
  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".notebook-entry-card").filter({ hasText: "Theme fixture" })).toContainText("Existing review comment");
});

test("book detail URL survives reload and keeps the summary columns", async ({ page }) => {
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library&year=all&q=Theme");
  await page.locator(".library-table").getByRole("button", { name: "Ver detalles de Theme fixture", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("detail")).toBe("20000000-0000-4000-8000-000000000001");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveAttribute("aria-selected", "true");
  const finished = page.getByRole("button", { name: "Editar Terminé de Theme fixture", exact: true });
  const impression = page.getByRole("button", { name: "Editar Impresiones de Theme fixture", exact: true });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const [a, b] = await Promise.all([finished.boundingBox(), impression.boundingBox()]);
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(3);
    expect(b!.x).toBeGreaterThan(a!.x);
    await page.locator(".library-notebook-spread").screenshot({ path: join(tmpdir(), `notebook-summary-todo-${width}.png`), animations: "disabled" });
  }
  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("detail")).toBe(false);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Theme");
});

test("browser back keeps a dirty detail draft and a missing detail returns to the list", async ({ page }) => {
  await mockApp(page);
  await page.goto("./?tab=library&year=all");
  await page.locator(".library-table").getByRole("button", { name: "Ver detalles de Theme fixture", exact: true }).click();
  await page.getByRole("tab", { name: "Más", exact: true }).click();
  await page.getByRole("combobox", { name: "Escala de producción", exact: true }).selectOption("indie");
  await page.evaluate(() => { history.pushState(null, "", "/?tab=library&year=all"); dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.getByRole("combobox", { name: "Escala de producción", exact: true })).toHaveValue("indie");
  expect(new URL(page.url()).searchParams.has("detail")).toBe(true);
  await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
  await page.getByRole("button", { name: "Descartar cambios", exact: true }).click();
  await page.goto("./?tab=library&year=all&detail=20000000-0000-4000-8000-999999999999");
  await expect(page.locator(".library-table")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has("detail")).toBe(false);
});

test("Biblioteca list scroll returns focus to the game edit button", async ({ page }) => {
  await mockApp(page, true);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("./?tab=library&year=all");
    await expect(page.getByRole("group", { name: "Vista de Biblioteca" })).toHaveCount(0);
    const list = width === 390 ? page.locator(".notebook-entry-list") : page.locator(".library-table");
    const start = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(start);
    const target = width === 390 ? page.locator(".notebook-entry-card").filter({ hasText: "Index fixture 28" }) : page.locator(".library-table");
    await target.scrollIntoViewIfNeeded();
    const returnFocus = width === 390
      ? target.getByRole("button", { name: "Editar rápidamente Index fixture 28", exact: true })
      : target.getByRole("button", { name: "Ver detalles de Index fixture 28", exact: true });
    await returnFocus.click();
    await expect(page.locator(".library-notebook-page-heading")).toContainText("Index fixture 28");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "← Biblioteca", exact: true }).click();
    await expect(list).toBeVisible();
    await expect(target).toBeInViewport();
    await expect(returnFocus).toBeFocused();
  }
});

test("discounted wishlist and released upcoming highlights follow the light theme", async ({
  page,
}) => {
  const { memberId, storedAppearance } = await mockApp(page);

  const wishlist = {
    ...emptyRecord,
    id: "21000000-0000-4000-8000-000000000001",
    gameId: "31000000-0000-4000-8000-000000000001",
    title: "Discount fixture",
    status: "wishlist",
    device: "PC",
    updated_at: "2026-10-20T10:00:00Z",
  };
  const upcoming = {
    ...emptyRecord,
    id: "21000000-0000-4000-8000-000000000002",
    gameId: "31000000-0000-4000-8000-000000000002",
    title: "Released fixture",
    status: "upcoming",
    release: "2026-01-01",
    device: "Nintendo Switch",
    updated_at: "2026-10-19T10:00:00Z",
  };

  await page.route("**/api/records?*", (route) =>
    route.fulfill({
      json: {
        records: [wishlist, upcoming],
        member: { id: memberId, display_name: "Fixture", role: "member" },
      },
    }),
  );
  await page.route("**/api/offers", (route) =>
    route.fulfill({
      json: [
        {
          id: "offer-highlight-fixture",
          game_id: wishlist.gameId,
          url: "https://store.example.test/discount-fixture",
          store: "Fixture Store",
          region: "US",
          currency: "USD",
          price: 5,
          regular_price: 10,
          discount: 50,
          status: "available",
          checked_at: "2026-10-20T10:00:00Z",
          error: null,
          watched: true,
          target_price: null,
        },
      ],
    }),
  );

  const shell = page.locator(".app-shell.notebook-app");
  for (const [view, desktopSelector, mobileSelector] of [
    [
      "wishlist",
      "tbody tr.wishlist-discounted",
      ".mobile-game.wishlist-discounted",
    ],
    [
      "upcoming",
      "tbody tr.upcoming-released",
      ".mobile-game.upcoming-released",
    ],
  ] as const) {
    storedAppearance.set(memberId, { mode: "light", game: null, palette: null });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`./?tab=${view}`);
    await expect(shell).toHaveCSS("--accent", "#a46b32");
    await expect(shell).toHaveCSS("--collection-highlight", "#a4a432");
    const row = page.locator(desktopSelector).filter({ hasText: "fixture" });
    const stripe = row.locator("td:first-child");
    await expect(row).toBeVisible();
    expect(
      await stripe.evaluate((element) => getComputedStyle(element).boxShadow),
    ).toContain("164, 164, 50");
    const defaultBackground = await row.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await row.hover();
    const hoverBackground = await row.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(hoverBackground).not.toBe(defaultBackground);
    await row.screenshot({
      path: join(tmpdir(), `notebook-${view}-highlight-light-row.png`),
      animations: "disabled",
    });
    await page.screenshot({
      path: join(tmpdir(), `notebook-${view}-highlight-light-library.png`),
      animations: "disabled",
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRow = page.locator(mobileSelector).filter({
      hasText: "fixture",
    });
    await expect(mobileRow).toBeVisible();
    expect(
      await mobileRow.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      ),
    ).toContain("164, 164, 50");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await mobileRow.screenshot({
      path: join(tmpdir(), `notebook-${view}-highlight-light-390.png`),
      animations: "disabled",
    });

    storedAppearance.set(memberId, { mode: "dark", game: null, palette: null });
    await page.reload();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(shell).toHaveCSS("--accent", "#c4a25a");
    expect(
      await stripe.evaluate((element) => getComputedStyle(element).boxShadow),
    ).toContain("164, 164, 50");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await mobileRow.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      ),
    ).toContain("164, 164, 50");
  }
});

async function mockApp(page: Page, paginationFixture = false, reviewFixture = false) {
  const memberId = "10000000-0000-4000-8000-000000000001";
  const records = [
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000001",
      gameId: "30000000-0000-4000-8000-000000000001",
      title: "Theme fixture",
      status: "completed",
      period: "2026",
      started: "2026-01-02",
      finished: "2026-01-10",
      device: "PC",
      hours: 12,
      rating: 84,
      updated_at: "2026-10-20T10:00:00Z",
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000002",
      gameId: "30000000-0000-4000-8000-000000000002",
      title: "Wishlist fixture",
      status: "wishlist",
      device: "Steam Deck",
      updated_at: "2026-10-19T10:00:00Z",
    },
    {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000003",
      gameId: "30000000-0000-4000-8000-000000000003",
      title: "Playing fixture",
      status: "playing",
      device: "Nintendo Switch",
      started: "2026-10-01",
      hours: 5,
      updated_at: "2026-10-18T10:00:00Z",
    },
  ];
  if (reviewFixture) records[0].review_details = "Existing review comment";
  if (paginationFixture) {
    records.push(...Array.from({ length: 28 }, (_, index) => ({
      ...emptyRecord,
      id: `20000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
      gameId: `30000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
      title: `Index fixture ${String(index + 1).padStart(2, "0")}`,
      status: "completed",
      period: "2026",
      started: `2026-02-${String((index % 27) + 1).padStart(2, "0")}`,
      finished: "2026-03-01",
      updated_at: `2026-10-${String((index % 27) + 1).padStart(2, "0")}T10:00:00Z`,
    })));
  }

  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/records" && route.request().method() === "POST") {
      const incoming = route.request().postDataJSON() as Record<string, unknown>;
      const index = records.findIndex((record) => record.id === incoming.id);
      if (index < 0) return route.fulfill({ status: 404, json: { error: "Not found" } });
      const saved = { ...records[index], ...incoming, updated_at: "2026-11-17T12:00:00Z" } as (typeof records)[number];
      records[index] = saved;
      return route.fulfill({ json: { id: saved.id, gameId: saved.gameId, record: saved } });
    }
    if (pathname === "/api/records")
      return route.fulfill({
        json: { records, member: { id: memberId, display_name: "Fixture", role: "member" } },
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
    if (pathname === "/api/notification-settings")
      return route.fulfill({
        json: { discounts: true, targets: true, releases: true },
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
    if (pathname === "/api/backups")
      return route.fulfill({
        json: {
          checkedAt: new Date().toISOString(),
          latest: null,
          lastSuccess: null,
        },
      });
    return route.fulfill({ json: [] });
  });
  const storedAppearance = await mockMemberAppearance(page, () => memberId);
  return { memberId, storedAppearance };
}

test("history, wishlist, and upcoming share the Biblioteca collection header", async ({
  page,
}) => {
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("./?tab=journal");
  await expect(page.locator(".app-shell.notebook-library")).toBeVisible();
  await expect(page.locator(".notebook-library-heading h1")).toHaveText(
    "Histórico",
  );
  await expect(page.locator(".notebook-library-kicker")).toContainText(
    "Todos los años",
  );
  await expect(page.locator(".notebook-library-search")).toBeVisible();
  await expect(page.getByLabel("Filtrar reseña")).toHaveCount(1);
  await expect(page.locator(".journal-table")).toContainText("Theme fixture");
  await expect(page.locator(".journal-table")).toContainText("2026");
  await page.screenshot({
    path: "test-results/collection-history-desktop.png",
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?tab=journal");
  const historyCard = page
    .locator(".notebook-entry-card")
    .filter({ hasText: "Theme fixture" });
  await expect(historyCard).toHaveCount(1);
  await expect(historyCard).toContainText("2026");
  await page.screenshot({
    path: "test-results/collection-history-mobile.png",
    fullPage: true,
    animations: "disabled",
  });

  for (const [view, title] of [
    ["wishlist", "Lista de deseos"],
    ["upcoming", "Próximos"],
  ] as const) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`./?tab=${view}`);
    await expect(page.locator(".notebook-library-heading h1")).toHaveText(
      title,
    );
    await expect(page.locator(".notebook-library-kicker")).toContainText(
      "juego",
    );
    await expect(page.locator(".notebook-library-search")).toBeVisible();
    await expect(page.locator(".notebook-view-sort")).toBeVisible();
    await expect(
      page.getByLabel(
        view === "wishlist" ? "Ordenar Lista de deseos" : "Ordenar Próximos",
      ),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/collection-${view}-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `test-results/collection-${view}-mobile.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("the charcoal notebook theme and four-action navigation cover every tab", async ({
  page,
}) => {
  await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const [view, label] of views) {
    await page.goto(`./?tab=${view}`);
    const shell = page.locator(".app-shell.notebook-app");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveCSS("--bg", "#222326");
    await expect(shell).toHaveCSS("--surface", "#2b2c30");
    await expect(page.locator(".sidebar nav button.active")).toContainText(
      label,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(1280);
    await page.screenshot({
      path: join(tmpdir(), `notebook-theme-${view}-desktop.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [view] of views) {
      await page.goto(`./?tab=${view}`);
      await expect(
        page.locator(".notebook-app .notebook-bottom-nav button"),
      ).toHaveCount(4);
      const expectedCurrent = ["library", "journal"].includes(view)
        ? "Biblioteca"
        : view === "wishlist"
          ? "Deseos"
          : view === "upcoming"
            ? "Próximos"
            : "Más";
      await expect(
        page
          .locator(".notebook-bottom-nav")
          .getByRole("button", { name: expectedCurrent }),
      ).toHaveAttribute("aria-current", "page");
      if (view === "journal")
        await expect(
          page.getByRole("link", { name: "Histórico", exact: true }),
        ).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390) {
        await page.screenshot({
          path: join(tmpdir(), `notebook-theme-${view}-390.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }

  await page.goto("./?tab=statistics");
  await page
    .locator(".notebook-bottom-nav")
    .getByRole("button", { name: "Más" })
    .click();
  await expect(page.locator(".sidebar.open nav button")).toHaveCount(7);
  await expect(
    page.locator(".sidebar.open").getByRole("button", {
      name: "Cerrar sesión",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator(".sidebar.open")
    .getByRole("button", { name: "Configuración" })
    .click();
  await expect(page.locator(".sidebar.open")).toHaveCount(0);
  await expect(
    page.locator(".notebook-bottom-nav").getByRole("button", { name: "Más" }),
  ).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");
  await page.locator(".notebook-library-add").click();
  const editor = page.locator(".modal-content");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS("--surface", "#2b2c30");
  await expect(editor).toHaveCSS("color", "rgb(238, 234, 224)");
  await page.screenshot({
    path: join(tmpdir(), "notebook-theme-editor-portal.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("collection filters remain discoverable inside a compact disclosure", async ({
  page,
}) => {
  await mockApp(page);

  for (const width of [1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./?tab=wishlist");
    const boxes = await page.evaluate(() => {
      const search = document
        .querySelector(".notebook-view-toolbar .search")!
        .getBoundingClientRect();
      const filters = document
        .querySelector(".notebook-view-filters > summary")!
        .getBoundingClientRect();
      const sort = document
        .querySelector(".notebook-view-sort")!
        .getBoundingClientRect();
      const refresh = document
        .querySelector(".notebook-view-toolbar-actions > .secondary")!
        .getBoundingClientRect();
      return [search, filters, sort, refresh].map(({ top, height }) => ({
        top,
        height,
      }));
    });
    for (const box of boxes.slice(1)) {
      expect(Math.abs(boxes[0].top - box.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[0].height - box.height)).toBeLessThanOrEqual(1);
    }
  }

  for (const view of ["wishlist", "upcoming"] as const) {
    for (const width of [1100, 980, 869]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`./?tab=${view}`);
      const toolbar = page.locator(".notebook-view-toolbar");
      const search = await toolbar.locator(".search").boundingBox();
      const filters = await toolbar
        .locator(".notebook-view-filters > summary")
        .boundingBox();
      const sort = await toolbar.locator(".notebook-view-sort").boundingBox();
      const refresh = await toolbar
        .getByRole("button", { name: "Actualizar precios" })
        .boundingBox();
      const toolbarBox = await toolbar.boundingBox();
      for (const box of [search, filters, sort, refresh])
        expect(box).not.toBeNull();
      expect(search!.width).toBeGreaterThanOrEqual(160);
      expect(search!.y + search!.height).toBeLessThan(filters!.y);
      for (const box of [filters!, sort!, refresh!]) {
        expect(box.x).toBeGreaterThanOrEqual(toolbarBox!.x);
        expect(box.x + box.width).toBeLessThanOrEqual(
          toolbarBox!.x + toolbarBox!.width,
        );
        expect(box.y).toBeGreaterThan(search!.y);
      }
      const actionBoxes = [filters!, sort!, refresh!];
      for (let left = 0; left < actionBoxes.length; left++) {
        for (let right = left + 1; right < actionBoxes.length; right++) {
          const a = actionBoxes[left];
          const b = actionBoxes[right];
          const overlaps =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlaps).toBe(false);
        }
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 869)
        await page.screenshot({
          path: `test-results/toolbar-${view}-narrow.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
  }

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ["journal", "wishlist", "upcoming"] as const) {
      await page.goto(`./?tab=${view}`);
      await expect(
        page.getByLabel("Buscar juegos en esta lista", { exact: true }),
      ).toBeVisible();
      const filters = page.locator(".notebook-view-filters > summary");
      const sort = page.locator(".notebook-view-sort");
      await expect(filters).toBeVisible();
      await expect(sort).toBeVisible();
      const toolbar = page.locator(".notebook-view-toolbar");
      const search = toolbar.locator(".search");
      const searchBox = await search.boundingBox();
      const toolbarBox = await toolbar.boundingBox();
      expect(searchBox?.x).toBe(toolbarBox?.x);
      expect(searchBox?.width).toBe(toolbarBox?.width);
      await expect(page.getByLabel("Filtrar plataforma")).not.toBeVisible();
      if (view === "upcoming") {
        const refresh = page.getByRole("button", {
          name: "Actualizar precios",
        });
        await expect(refresh).toBeVisible();
        const [filterBox, sortBox, refreshBox] = await Promise.all([
          filters.boundingBox(),
          sort.boundingBox(),
          refresh.boundingBox(),
        ]);
        expect(filterBox?.height).toBe(refreshBox?.height);
        expect(filterBox?.height).toBe(sortBox?.height);
        expect(filterBox?.y).toBe(sortBox?.y);
        expect(refreshBox!.y).toBeGreaterThan(filterBox!.y);
      } else {
        const [filterBox, sortBox] = await Promise.all([
          filters.boundingBox(),
          sort.boundingBox(),
        ]);
        expect(filterBox?.height).toBe(sortBox?.height);
        expect(filterBox?.y).toBeCloseTo(sortBox!.y, 0);
      }
      await filters.click();
      await expect(page.getByLabel("Filtrar plataforma")).toBeVisible();
      if (view === "journal") {
        await page.getByLabel("Filtrar reseña").selectOption("with");
        expect(new URL(page.url()).searchParams.get("review")).toBe("with");
      } else if (view === "wishlist") {
        await page.getByLabel("Filtrar descuentos").selectOption("discounted");
        expect(new URL(page.url()).searchParams.get("discount")).toBe(
          "discounted",
        );
      }
    }
  }
});

async function dispatchTouchSwipe(page: Page, target: Locator, dx: number, dy: number, gutter = false) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const x = gutter ? box!.x + 8 : box!.x + box!.width / 2;
  const y = box!.y + Math.min(box!.height / 2, 90);
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * 0.55, y: y + dy * 0.55 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx, y: y + dy }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

test.describe("mobile book page swipes", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  async function openBook(page: Page) {
    await mockApp(page);
    await page.goto("./?tab=library");
    await page.locator(".notebook-entry-card").filter({ hasText: "Theme fixture" }).getByRole("button", { name: "Editar rápidamente Theme fixture" }).click();
  }

  test("book touch swipes navigate the three tabs without saving", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/records") && request.method() === "POST") posts.push(request.url());
    });
    await openBook(page);
    await dispatchTouchSwipe(page, page.locator(".notebook-book-header"), -130, 0);
    await expect(page.getByRole("tab", { name: "Principal", exact: true })).toHaveAttribute("aria-selected", "true");
    await dispatchTouchSwipe(page, page.locator(".notebook-book-header"), -130, 0);
    await expect(page.getByRole("tab", { name: "Más", exact: true })).toHaveAttribute("aria-selected", "true");
    await dispatchTouchSwipe(page, page.locator(".notebook-book-header"), 130, 0);
    await expect(page.getByRole("tab", { name: "Principal", exact: true })).toHaveAttribute("aria-selected", "true");
    await dispatchTouchSwipe(page, page.locator(".notebook-book-header"), 130, 0);
    await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(posts).toEqual([]);
  });

  test("vertical and input swipes do not change tabs and dirty form stays guarded", async ({ page }) => {
    await openBook(page);
    const totalScroll = () => page.evaluate(() => window.scrollY + Array.from(document.querySelectorAll<HTMLElement>("*"))
      .reduce((total, node) => total + node.scrollTop, 0));
    const before = await totalScroll();
    await dispatchTouchSwipe(page, page.locator(".notebook-book-editor"), 0, -180, true);
    await expect.poll(totalScroll).toBeGreaterThan(before);
    await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Principal", exact: true }).click();
    const focus = page.getByRole("textbox", { name: "Historia, gameplay o ambos", exact: true });
    await dispatchTouchSwipe(page, focus, -140, 0);
    await expect(page.getByRole("tab", { name: "Principal", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Más", exact: true }).click();
    await page.getByRole("combobox", { name: "Escala de producción", exact: true }).selectOption("indie");
    await dispatchTouchSwipe(page, page.locator(".notebook-book-header"), 130, 0);
    await expect(page.getByRole("tab", { name: "Principal", exact: true })).toHaveAttribute("aria-selected", "true");
    await dispatchTouchSwipe(page, page.locator(".notebook-book-header"), 130, 0);
    await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toBeDisabled();
    await expect(page.getByRole("tab", { name: "Principal", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Más", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Escala de producción", exact: true })).toHaveValue("indie");
  });

  test("dirty inline summary blocks touch navigation", async ({ page }) => {
    await openBook(page);
    await page.getByRole("button", { name: "Editar Nombre de Theme fixture" }).click();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Theme draft");
    await dispatchTouchSwipe(page, page.locator(".notebook-book-header"), -140, 0);
    await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Theme draft");
  });
});
