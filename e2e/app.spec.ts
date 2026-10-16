import { test, expect } from "@playwright/test";
test("private app offers login without public signup", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Tu próxima partida empieza acá." }),
  ).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar al diario" }),
  ).toBeVisible();
  await expect(page.getByText("Crear cuenta")).toHaveCount(0);
});
test("journal is protected and login fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("private endpoints reject anonymous requests", async ({ request }) => {
  for (const path of [
    "/api/records",
    "/api/sharing",
    "/api/export",
    "/api/push",
  ]) {
    const r = await request.get(path);
    expect(r.status()).toBe(401);
  }
});

test("new passwords require eight characters, an uppercase letter and a number", async ({
  page,
}) => {
  await page.goto("/password");
  const password = page.getByLabel("Contraseña nueva");
  for (const [value, valid] of [
    ["Abcdefg1", true],
    ["ABCDEFG1", true],
    ["Abcdef1", false],
    ["abcdefgh1", false],
    ["Abcdefgh", false],
  ] as const) {
    await password.fill(value);
    expect(
      await password.evaluate((input: HTMLInputElement) =>
        input.checkValidity(),
      ),
      value,
    ).toBe(valid);
  }
});
