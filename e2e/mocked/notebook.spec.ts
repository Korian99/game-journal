import { expect, test, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JournalEntry } from "../../src/lib/journal/journal-types";
import { emptyRecord } from "../../src/lib/types";
import { openFullGame } from "./open-full-game";

async function mockApp(page: Page, initialContent = "Previous notebook note") {
  const state = {
    content: initialContent,
    getFailures: 0,
    putFailures: 0,
    writes: [] as unknown[],
    records: [] as JournalEntry[],
    recordWrites: [] as JournalEntry[],
    recordFailures: 0,
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
    if (path === "/api/records") {
      if (request.method() === "POST") {
        const input = request.postDataJSON() as JournalEntry;
        state.recordWrites.push(input);
        if (state.recordFailures > 0) {
          state.recordFailures -= 1;
          return route.fulfill({
            status: 503,
            json: { error: "No se pudo guardar el juego.", code: "TEMPORARY" },
          });
        }
        const index = state.records.findIndex(
          (record) => record.id === input.id,
        );
        if (state.records[index]?.updated_at !== input.updated_at)
          return route.fulfill({
            status: 409,
            json: { error: "CONFLICT: stale game", code: "CONFLICT" },
          });
        const record = { ...input, updated_at: "2026-11-11T10:02:00Z" };
        state.records[index] = record;
        return route.fulfill({
          json: { id: record.id, gameId: record.gameId, record },
        });
      }
      return route.fulfill({
        json: {
          records: state.records,
          member: { display_name: "Fixture", role: "member" },
        },
      });
    }
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
      page.getByRole("heading", {
        name: "Apariencia y preferencias",
        exact: true,
      }),
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

test("shows how to add a game note when no games are in progress", async ({
  page,
}) => {
  const state = await mockApp(page, "");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?tab=library");
  await page.getByRole("button", { name: "Abrir cuaderno" }).click();

  const dialog = page.getByRole("dialog", { name: "Cuaderno" });
  await expect(
    dialog.getByText("Acá aparecen los juegos marcados como Jugando."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "Juego en curso" }),
  ).toBeDisabled();
  const notes = dialog.getByRole("textbox", { name: "Notas" });
  await notes.fill("General notebook note");
  await expect(
    dialog.getByRole("button", { name: "Agregar al recordatorio" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Guardado");
  expect(state.content).toBe("General notebook note");
  expect(state.recordWrites).toHaveLength(0);
});

for (const width of [1280, 390]) {
  test(`adds a notebook note to a game in progress at ${width}px`, async ({
    page,
  }) => {
    const conflict = width === 1280;
    const state = await mockApp(page);
    const currentGame: JournalEntry = {
      ...emptyRecord,
      id: "20000000-0000-4000-8000-000000000001",
      gameId: "30000000-0000-4000-8000-000000000001",
      title: "Current game",
      status: "playing",
      review_details: "Previous game comment",
      reminder: "Previous game reminder",
      updated_at: "2026-11-11T10:00:00Z",
    };
    state.records = [
      currentGame,
      {
        ...currentGame,
        id: "20000000-0000-4000-8000-000000000002",
        gameId: "30000000-0000-4000-8000-000000000002",
        title: "Finished game",
        status: "completed",
      },
    ];
    if (!conflict) state.recordFailures = 1;
    await page.setViewportSize({ width, height: 844 });
    await page.goto("./?tab=library&year=all");
    await page.getByRole("button", { name: "Abrir cuaderno" }).click();

    const dialog = page.getByRole("dialog", { name: "Cuaderno" });
    const notes = dialog.getByRole("textbox", { name: "Notas" });
    const games = dialog.getByRole("combobox", { name: "Juego en curso" });
    const add = dialog.getByRole("button", { name: "Agregar al recordatorio" });
    const text = "New note\nSecond line";

    await expect(notes).toHaveValue("Previous notebook note");
    await notes.fill(text);
    await expect(games.getByRole("option")).toHaveText([
      "Elegí un juego",
      "Current game",
    ]);
    await expect(add).toBeDisabled();
    await games.selectOption({ label: "Current game" });

    if (conflict) {
      const oversized = "x".repeat(5_000);
      await notes.fill(oversized);
      await add.click();
      await expect(dialog.getByRole("alert")).toHaveText(
        "El recordatorio admite hasta 5.000 caracteres. Acortá el texto.",
      );
      await expect(notes).toHaveValue(oversized);
      expect(state.recordWrites).toHaveLength(0);
      await notes.fill(text);

      state.records[0] = {
        ...currentGame,
        reminder: `${currentGame.reminder}\n\nConcurrently added reminder`,
        updated_at: "2026-11-11T10:01:00Z",
      };
    }
    const current = state.records[0];
    await add.click();

    await expect(dialog.getByRole("alert")).toHaveText(
      conflict
        ? "La partida cambió. Revisá la selección y volvé a intentarlo."
        : "No se pudo guardar el juego.",
    );
    await expect(notes).toHaveValue(text);
    expect(state.recordWrites).toHaveLength(1);
    await add.click();

    await expect(dialog.getByRole("status")).toHaveText(
      "Nota agregada al recordatorio de Current game.",
    );
    await expect(notes).toHaveValue(text);
    await expect(add).toBeDisabled();
    expect(state.records[0].reminder).toBe(`${current.reminder}\n\n${text}`);
    expect(state.records[0].review_details).toBe(currentGame.review_details);
    expect(state.recordWrites).toHaveLength(2);
    expect(state.recordWrites[0]).toMatchObject({
      updated_at: currentGame.updated_at,
    });
    expect(state.recordWrites[1]).toMatchObject({
      id: currentGame.id,
      updated_at: current.updated_at,
    });
    expect(state.writes).toHaveLength(0);

    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText("Guardado");
    expect(state.content).toBe(text);
    if (conflict) {
      await dialog.getByRole("button", { name: "Cerrar" }).click();
      await openFullGame(page, currentGame.title);
      await expect(
        page.getByRole("region", { name: "Recordatorio para la próxima partida" }),
      ).toContainText("Concurrently added reminder New note Second line");
    }
  });
}
