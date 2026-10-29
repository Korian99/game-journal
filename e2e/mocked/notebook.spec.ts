import { expect, test, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function mockApp(page: Page, initialContent = "Previous notebook note") {
  const state = {
    content: initialContent,
    getFailures: 0,
    putFailures: 0,
    writes: [] as unknown[],
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/notebook") {
      if (request.method() === "GET" && state.getFailures > 0) {
        state.getFailures -= 1;
        return route.fulfill({
          status: 503,
          json: {
            error: "Notebook unavailable",
            code: "TEMPORARY",
          },
        });
      }
      if (request.method() === "GET")
        return route.fulfill({ json: { content: state.content } });

      const body = request.postDataJSON() as { content?: unknown };
      state.writes.push(body);
      if (state.putFailures > 0) {
        state.putFailures -= 1;
        return route.fulfill({
          status: 503,
          json: { error: "Notebook unavailable", code: "TEMPORARY" },
        });
      }
      if (typeof body.content === "string") state.content = body.content;
      return route.fulfill({ json: { content: state.content } });
    }
    if (path === "/api/records")
      return route.fulfill({
        json: {
          records: [],
          member: { display_name: "Fixture", role: "member" },
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

  return state;
}

test("the header stays visible while scrolling and dialogs open above it", async ({
  page,
}) => {
  await mockApp(page);
  for (const width of [1280, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("./?tab=settings");
    await expect(
      page.getByRole("heading", { name: "Preferencias", exact: true }),
    ).toBeAttached();
    await page.evaluate(() =>
      window.scrollTo({ top: 600, behavior: "instant" }),
    );
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(300);
    const header = await page.locator(".topbar").boundingBox();
    expect(Math.abs(header!.y)).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: join(tmpdir(), `notebook-sticky-header-${width}.png`),
    });
    await page
      .getByRole("button", { name: "Abrir cuaderno", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Cuaderno" });
    await expect(
      dialog.getByRole("textbox", { name: "Notas", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
});

test("the notebook opens beside notifications and persists exact plain text", async ({
  page,
}) => {
  const state = await mockApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./?tab=library");

  const topbarButtons = page.locator(".topbar-right > button");
  await expect(topbarButtons.nth(0)).toHaveAttribute(
    "aria-label",
    "Abrir cuaderno",
  );
  await expect(topbarButtons.nth(1)).toHaveAttribute(
    "aria-label",
    "Ver notificaciones",
  );
  await topbarButtons.nth(0).click();
  const dialog = page.getByRole("dialog", { name: "Cuaderno" });
  const notes = dialog.getByRole("textbox", { name: "Notas" });
  await expect(notes).toHaveValue("Previous notebook note");
  await page.screenshot({
    path: join(tmpdir(), "notebook-modal-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  const exactText = "  First line\n\n<script>plain text</script> 世界\n ";
  await notes.fill(exactText);
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Guardado");
  expect(state.writes).toEqual([{ content: exactText }]);
  await dialog.getByRole("button", { name: "Cerrar" }).click();

  await topbarButtons.nth(0).click();
  await expect(dialog.getByRole("textbox", { name: "Notas" })).toHaveValue(
    exactText,
  );
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await page.reload();
  await topbarButtons.nth(0).click();
  await expect(dialog.getByRole("textbox", { name: "Notas" })).toHaveValue(
    exactText,
  );

  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".topbar-right")
    .getByRole("button", { name: "Abrir cuaderno" })
    .click();
  await expect(page.getByRole("textbox", { name: "Notas" })).toHaveValue(
    exactText,
  );
  await page.screenshot({
    path: join(tmpdir(), "notebook-modal-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("save failures keep the draft available for retry", async ({ page }) => {
  const state = await mockApp(page, "");
  state.putFailures = 1;
  await page.goto("./?tab=journal");
  await page.getByRole("button", { name: "Abrir cuaderno" }).click();
  const dialog = page.getByRole("dialog", { name: "Cuaderno" });
  const notes = dialog.getByRole("textbox", { name: "Notas" });
  await expect(notes).toHaveValue("");
  await notes.fill("keep this unsaved draft");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(notes).toHaveValue("keep this unsaved draft");
  await expect(
    dialog.getByRole("button", { name: "Guardar", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Guardado");
  expect(state.content).toBe("keep this unsaved draft");
});

test("failed initial loading blocks blank saves and can be retried", async ({
  page,
}) => {
  const state = await mockApp(page, "Existing server notes");
  state.getFailures = 1;
  await page.goto("./?tab=statistics");
  await page.getByRole("button", { name: "Abrir cuaderno" }).click();
  const dialog = page.getByRole("dialog", { name: "Cuaderno" });
  const notes = dialog.getByRole("textbox", { name: "Notas" });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(notes).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Guardar", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole("button", { name: "Reintentar carga" }).click();
  await expect(notes).toHaveValue("Existing server notes");
  await expect(
    dialog.getByRole("button", { name: "Guardar", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
