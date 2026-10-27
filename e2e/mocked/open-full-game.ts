import type { Page } from "@playwright/test";
/** Full-editor scenarios go through the deliberate pencil on touch layouts. */
export async function openFullGame(page: Page, title: string) {
  const touch = await page.evaluate(
    () => window.matchMedia("(max-width: 760px), (pointer: coarse)").matches,
  );
  if (touch) {
    await page
      .getByRole("button", { name: "Editar rápidamente " + title, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Edición rápida", exact: true })
      .getByRole("button", { name: "Abrir formulario completo", exact: true })
      .click();
  } else
    await page
      .getByRole("button", { name: "Ver detalles de " + title, exact: true })
      .click();
}
