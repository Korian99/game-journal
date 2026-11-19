import { expect, test } from "@playwright/test";
import { mockMemberAppearance } from "./mock-member-appearance";

test("the journal palette previews safely and persists per member in both modes", async ({ page }, testInfo) => {
  let memberId = "10000000-0000-4000-8000-000000000001";
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records") {
      return route.fulfill({ json: { records: [], member: { id: memberId, role: "member", display_name: "Fixture" } } });
    }
    if (path === "/api/sharing") {
      return route.fulfill({ json: { shared: [], members: [], grants: [] } });
    }
    return route.fulfill({ json: [] });
  });
  await mockMemberAppearance(page, () => memberId);
  const appearance = page.getByRole("heading", { name: "Apariencia", exact: true });
  const customize = page.getByRole("button", { name: "Personalizar colores", exact: true });
  const dialog = page.getByRole("dialog", { name: "Colores del diario" });
  const preview = dialog.getByRole("group", { name: "Vista previa del diario" });
  const apply = dialog.getByRole("button", { name: "Aplicar" });
  const shell = page.locator(".app-shell");
  const pageBackground = page.locator(".main");
  await page.goto("./?tab=settings");
  await expect(appearance).toBeVisible();
  await expect(customize).toBeVisible({ timeout: 1500 });
  await customize.click();
  await dialog.getByRole("button", { name: "Bosque", exact: true }).click();
  await expect(preview).toHaveCSS("background-color", "rgb(25, 34, 29)");
  await expect(pageBackground).toHaveCSS("background-color", "rgb(34, 35, 38)");
  await dialog.getByLabel("Texto", { exact: true }).fill("#19221d");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(apply).toBeDisabled();
  await dialog.getByLabel("Fondo", { exact: true }).fill("#142118");
  await dialog.getByLabel("Superficies", { exact: true }).fill("#25332a");
  await dialog.getByLabel("Texto", { exact: true }).fill("#fafff8");
  await dialog.getByLabel("Acento", { exact: true }).fill("#91c9a0");
  await expect(apply).toBeEnabled();
  await dialog.screenshot({ path: testInfo.outputPath("colores-oscuro-escritorio.png"), animations: "disabled" });
  await apply.click();
  await expect(customize).toBeFocused();
  await expect(pageBackground).toHaveCSS("background-color", "rgb(20, 33, 24)");
  await expect(page.locator(".sidebar")).toHaveCSS("background-color", "rgb(37, 51, 42)");
  await expect(shell).toHaveCSS("--text", "#fafff8");
  await expect(shell).toHaveCSS("--accent", "#91c9a0");
  await page.reload();
  await expect(pageBackground).toHaveCSS("background-color", "rgb(20, 33, 24)");

  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(pageBackground).toHaveCSS("background-color", "rgb(237, 243, 233)");
  await page.setViewportSize({ width: 360, height: 800 });
  await customize.click();
  await expect(dialog).toHaveCSS("background-color", "rgb(247, 250, 243)");
  await expect(dialog.getByLabel("Fondo", { exact: true })).toHaveValue("#edf3e9");
  await dialog.getByRole("button", { name: "Océano", exact: true }).click();
  await expect(preview).toHaveCSS("background-color", "rgb(232, 242, 246)");
  await dialog.screenshot({ path: testInfo.outputPath("colores-claro-movil.png"), animations: "disabled" });
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(pageBackground).toHaveCSS("background-color", "rgb(237, 243, 233)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  const originalMember = memberId;
  memberId = "10000000-0000-4000-8000-000000000002";
  await page.reload();
  await expect(customize).toBeVisible();
  await expect(pageBackground).toHaveCSS("background-color", "rgb(34, 35, 38)");
  memberId = originalMember;
  await page.reload();
  await expect(pageBackground).toHaveCSS("background-color", "rgb(237, 243, 233)");
  await customize.click();
  await dialog.getByRole("button", { name: "Restaurar colores originales" }).click();
  await apply.click();
  await expect(pageBackground).toHaveCSS("background-color", "rgb(237, 229, 216)");
});
