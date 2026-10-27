import { test, expect, type Page, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
const id = "20000000-0000-4000-8000-000000000001";
const base = {
  ...emptyRecord,
  id,
  gameId: "30000000-0000-4000-8000-000000000001",
  title: "Quick fixture",
  status: "playing",
  started: "01/01/2026",
  period: "2026",
  hours: 10,
  rating: 80,
  notes: "Long review kept",
  updated_at: "2026-10-26T12:00:00Z",
};
async function setup(page: Page, status = "playing") {
  let record = { ...base, status };
  const pending: Route[] = [];
  let copies = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records") {
      if (route.request().method() === "POST") {
        pending.push(route);
        return;
      }
      return route.fulfill({
        json: {
          records: [
            record,
            ...Array.from({ length: copies }, (_, index) => ({
              ...record,
              id:
                "20000000-0000-4000-8000-" +
                String(index + 2).padStart(12, "0"),
              gameId:
                "30000000-0000-4000-8000-" +
                String(index + 2).padStart(12, "0"),
              title: "Extra fixture " + index,
            })),
          ],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    }
    return route.fulfill({
      json:
        path === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : path === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : path === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  return {
    pending,
    addCopies(count: number) {
      copies = count;
    },
    remoteUpdate() {
      record = {
        ...record,
        notes: "Remote review",
        updated_at: "2026-10-26T14:00:00Z",
      };
    },
    async succeed(index: number) {
      record = {
        ...record,
        ...pending[index].request().postDataJSON(),
        updated_at:
          "2026-10-26T12:" + String(index + 1).padStart(2, "0") + ":00Z",
      };
      await pending[index].fulfill({
        json: { id, gameId: record.gameId, record },
      });
    },
  };
}
const pencil = (page: Page) =>
  page.getByRole("button", {
    name: "Editar rápidamente Quick fixture",
    exact: true,
  });
const panel = (page: Page) =>
  page.getByRole("dialog", { name: "Edición rápida", exact: true });
test("cards do not open on taps or scrolling and only the pencil opens a panel without the keyboard", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page.locator(".mobile-game-info strong").tap();
  await page.mouse.wheel(0, 250);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await pencil(page).tap();
  await expect(panel(page)).toBeVisible();
  expect(
    await page.evaluate(() =>
      ["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement?.tagName ?? "",
      ),
    ),
  ).toBe(false);
  await expect(
    panel(page).getByRole("button", { name: "Guardar", exact: true }),
  ).toBeDisabled();
  await panel(page).getByRole("button", { name: "Cerrar", exact: true }).tap();
  await expect(panel(page)).toHaveCount(0);
  await expect(pencil(page)).toBeFocused();
  expect(f.pending).toHaveLength(0);
});
test("quick saves show progress, preserve other fields and can be undone", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await pencil(page).tap();
  await panel(page)
    .getByLabel("Estado", { exact: true })
    .selectOption("paused");
  await panel(page).getByLabel("Hs. jugadas", { exact: true }).fill("12.5");
  await panel(page).getByLabel("Reseña / 100", { exact: true }).fill("0");
  await panel(page).getByRole("button", { name: "Guardar", exact: true }).tap();
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(panel(page)).toContainText("Guardando");
  expect(f.pending[0].request().postDataJSON()).toMatchObject({
    id,
    status: "paused",
    hours: 12.5,
    rating: 0,
    notes: base.notes,
    updated_at: base.updated_at,
  });
  await f.succeed(0);
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".mobile-game")).toContainText("12.5");
  await page.getByRole("button", { name: "Deshacer", exact: true }).tap();
  await expect.poll(() => f.pending.length).toBe(2);
  expect(f.pending[1].request().postDataJSON()).toMatchObject({
    id,
    intent: "undo",
    status: "playing",
    hours: 10,
    rating: 80,
    notes: base.notes,
  });
  await f.succeed(1);
});
test("failed saves preserve the draft and every dismissal including browser Back requires confirmation", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  const url = page.url();
  await pencil(page).tap();
  await panel(page).getByLabel("Hs. jugadas", { exact: true }).fill("15");
  await panel(page).getByRole("button", { name: "Guardar", exact: true }).tap();
  await expect.poll(() => f.pending.length).toBe(1);
  await f.pending[0].fulfill({
    status: 409,
    json: { error: "La entrada cambió", code: "CONFLICT" },
  });
  await expect(panel(page).getByRole("alert")).toContainText(
    "La entrada cambió",
  );
  await expect(
    panel(page).getByLabel("Hs. jugadas", { exact: true }),
  ).toHaveValue("15");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toContainText("Descartar cambios");
  await panel(page)
    .getByRole("button", { name: "Seguir editando", exact: true })
    .tap();
  await page.goBack();
  await expect(panel(page)).toContainText("Descartar cambios");
  await panel(page)
    .getByRole("button", { name: "Seguir editando", exact: true })
    .tap();
  await panel(page).getByRole("button", { name: "Cerrar", exact: true }).tap();
  await expect(panel(page)).toContainText("Descartar cambios");
  await panel(page)
    .getByRole("button", { name: "Descartar", exact: true })
    .tap();
  await expect(panel(page)).toHaveCount(0);
  await expect(page).toHaveURL(url);
  expect(f.pending).toHaveLength(1);
});
test("opening the full form transfers the draft without saving and retains dirty-form protection", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await pencil(page).tap();
  await panel(page).getByLabel("Hs. jugadas", { exact: true }).fill("18");
  await panel(page)
    .getByLabel("Estado", { exact: true })
    .selectOption("paused");
  await panel(page)
    .getByRole("button", { name: "Abrir formulario completo", exact: true })
    .tap();
  const full = page.getByRole("dialog", { name: "Tu partida", exact: true });
  await expect(full).toBeVisible();
  expect(f.pending).toHaveLength(0);
  await expect(full.getByLabel("Estado", { exact: true })).toHaveValue(
    "paused",
  );
  await full.getByRole("tab", { name: "Reseña", exact: true }).tap();
  await expect(full.getByLabel("Horas jugadas", { exact: true })).toHaveValue(
    "18",
  );
  await full.getByRole("button", { name: "Cerrar", exact: true }).tap();
  await expect(page.getByRole("dialog")).toContainText("Descartar");
});
test("wide touch devices get deliberate editing instead of inline table controls", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("./?tab=library&year=all");
  await expect(page.locator(".table-scroll")).toBeHidden();
  await expect(pencil(page)).toBeVisible();
  await page.locator(".mobile-game-info strong").tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await pencil(page).tap();
  await expect(panel(page)).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-quick-edit-tablet.png" });
});
test("wishlist quick editing preserves textual priorities and leaves pages in the full form", async ({
  page,
}) => {
  const f = await setup(page, "wishlist");
  await page.goto("./?tab=wishlist");
  await pencil(page).tap();
  await panel(page).getByLabel("Prioridad", { exact: true }).fill("Migui");
  await expect(
    panel(page).getByLabel("Hs. jugadas", { exact: true }),
  ).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Guardar", exact: true }).tap();
  await expect.poll(() => f.pending.length).toBe(1);
  expect(f.pending[0].request().postDataJSON()).toMatchObject({
    priority: "Migui",
  });
  await f.succeed(0);
});

test("a swipe starting on the pencil scrolls without editing", async ({
  page,
}) => {
  const f = await setup(page);
  f.addCopies(12);
  await page.goto("./?tab=library&year=all");
  const box = (await pencil(page).boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 4; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - step * 50 }],
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect(f.pending).toHaveLength(0);
});
test("a changed server revision blocks the quick save and preserves the local draft", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await pencil(page).tap();
  await panel(page).getByLabel("Hs. jugadas", { exact: true }).fill("19");
  f.remoteUpdate();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".mobile-game")).toContainText("Remote review");
  await panel(page).getByRole("button", { name: "Guardar", exact: true }).tap();
  await expect(panel(page).getByRole("alert")).toContainText(
    "La entrada cambió",
  );
  await expect(
    panel(page).getByLabel("Hs. jugadas", { exact: true }),
  ).toHaveValue("19");
  expect(f.pending).toHaveLength(0);
});
test("offline quick editing stays read-only and an unchanged full-form transfer stays clean", async ({
  page,
  context,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await pencil(page).tap();
  await panel(page)
    .getByRole("button", { name: "Abrir formulario completo", exact: true })
    .tap();
  await page
    .getByRole("dialog", { name: "Tu partida", exact: true })
    .getByRole("button", { name: "Cerrar", exact: true })
    .tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.setOffline(true);
  await pencil(page).tap();
  await expect(panel(page)).toContainText("Necesitás conexión para guardar");
  await expect(
    panel(page).getByLabel("Hs. jugadas", { exact: true }),
  ).toBeDisabled();
  await panel(page).getByRole("button", { name: "Cerrar", exact: true }).tap();
  expect(f.pending).toHaveLength(0);
});
