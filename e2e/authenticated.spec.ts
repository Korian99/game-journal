import { test, expect } from "@playwright/test";
test("invited member can keep separate playthroughs, export and detect concurrent edits", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Requires a disposable invited fixture account",
  );
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Entrar al diario" }).click();
  await expect(page.getByRole("heading", { name: "Biblioteca." })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Agregar juego" }).click();
  await page.getByLabel("Nombre del juego").fill("Portal 2 · prueba");
  await page.getByLabel("Año de lanzamiento").fill("2011");
  await page.getByLabel("Dónde lo jugaste").fill("PC");
  await page.getByLabel("Estado", { exact: true }).selectOption("playing");
  await page.getByLabel("Comentarios · privados").fill("Solo para mi diario");
  await page.getByRole("button", { name: "Guardar entrada" }).click();
  await expect(page.getByRole("button", { name: /PO Portal 2/ })).toBeVisible();
  await page.getByRole("button", { name: /PO Portal 2/ }).click();
  await page
    .getByLabel("Enlace Steam o Nintendo")
    .fill("https://store.steampowered.com/app/620/?cc=US");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByRole("link", { name: /steam · US/ })).toBeVisible();
  await page.getByRole("button", { name: "Nueva partida" }).click();
  await expect(page.getByRole("button", { name: /PO Portal 2/ })).toHaveCount(
    2,
  );
  const data = await (await page.request.get("/api/records")).json();
  expect(data.records).toHaveLength(2);
  expect(new Set(data.records.map((r: any) => r.gameId)).size).toBe(1);
  const entry = data.records[0];
  const first = await page.request.post("/api/records", {
    data: { ...entry, notes: "Cambio desde otro dispositivo" },
  });
  expect(first.ok()).toBe(true);
  const stale = await page.request.post("/api/records", {
    data: { ...entry, notes: "Cambio viejo" },
  });
  expect(stale.status()).toBe(409);
  const exported = await page.request.get("/api/export");
  expect(exported.ok()).toBe(true);
  expect(await exported.text()).toContain("Cambio desde otro dispositivo");
  await page.reload();
  await expect(page.getByRole("button", { name: /PO Portal 2/ })).toHaveCount(
    2,
  );
  await page.screenshot({
    path: "test-results/library-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/library-mobile.png",
    fullPage: true,
  });
});
