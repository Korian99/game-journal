import { test, expect, type Page, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
async function setup(page: Page, status = "completed") {
  let record = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Inline fixture",
    device: "PC",
    status,
    period: "2026",
    started: "2026-01-01",
    finished: "",
    notes: "Original comment",
    rating: 80,
    updated_at: "2026-10-23T12:00:00Z",
  };
  const pending: Route[] = [];
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records") {
      if (route.request().method() === "POST") {
        pending.push(route);
        return;
      }
      return route.fulfill({
        json: {
          records: [record],
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
              checkedAt: "2026-10-23T11:00:00Z",
            }
          : path === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : path === "/api/backups"
              ? {
                  checkedAt: "2026-10-23T11:00:00Z",
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  return {
    pending,
    get record() {
      return record;
    },
    serverUpdate(patch: Partial<typeof record>) {
      record = { ...record, ...patch };
    },
    async succeed(index: number) {
      record = {
        ...record,
        ...pending[index].request().postDataJSON(),
        updated_at:
          "2026-10-23T12:" + String(index + 1).padStart(2, "0") + ":00Z",
      };
      await pending[index].fulfill({
        json: { id: record.id, gameId: record.gameId, record },
      });
    },
  };
}
test("desktop title edits save once with loading, allow undo, and retain a details modal", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .locator("table")
    .getByText("Inline fixture", { exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const input = page.getByRole("textbox", { name: "Nombre", exact: true });
  await expect(input).toBeFocused();
  await input.fill("Renamed fixture");
  await input.press("Enter");
  await expect.poll(() => f.pending.length).toBe(1);
  await expect(
    page.getByRole("status").filter({ hasText: "Guardando" }),
  ).toBeVisible();
  await f.succeed(0);
  await expect(
    page.locator("table").getByText("Renamed fixture", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Deshacer/ }).click();
  await expect.poll(() => f.pending.length).toBe(2);
  expect(f.pending[1].request().postDataJSON()).toMatchObject({
    title: "Inline fixture",
    intent: "undo",
    updated_at: f.record.updated_at,
  });
  await f.succeed(1);
  await expect(
    page.locator("table").getByText("Inline fixture", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Ver detalles de Inline fixture",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog", { name: "Tu partida" })).toBeVisible();
});
test("Escape cancels, failed saves preserve the draft, and console selection stays inline", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .getByRole("button", {
      name: "Editar Consola de Inline fixture",
      exact: true,
    })
    .click();
  const select = page.getByRole("combobox", { name: "Consola", exact: true });
  await select.selectOption("Nintendo DS");
  await select.press("Escape");
  expect(f.pending).toHaveLength(0);
  await page
    .getByRole("button", {
      name: "Editar Consola de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "Consola", exact: true })
    .selectOption("Nintendo DS");
  await page
    .getByRole("button", { name: "Guardar celda", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await f.pending[0].fulfill({
    status: 409,
    json: { error: "La entrada cambió", code: "CONFLICT" },
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "La entrada cambió" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Consola", exact: true }),
  ).toHaveValue("Nintendo DS");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("wishlist edits priority, access, and estimates without touching store prices", async ({
  page,
}) => {
  const f = await setup(page, "wishlist");
  await page.goto("./?tab=wishlist");
  for (const [label, value, field] of [
    ["Prioridad", "3", "priority"],
    ["Hs. estimadas", "10 - 20 - 30", "estimated"],
  ]) {
    const index = f.pending.length;
    await page
      .getByRole("button", {
        name: "Editar " + label + " de Inline fixture",
        exact: true,
      })
      .click();
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
    await page
      .getByRole("button", { name: "Guardar celda", exact: true })
      .click();
    await expect.poll(() => f.pending.length).toBe(index + 1);
    expect(f.pending[index].request().postDataJSON()[field]).toEqual(
      field === "priority" ? 3 : value,
    );
    await f.succeed(index);
  }
  await page
    .getByRole("button", {
      name: "Editar Acceso de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "Acceso", exact: true })
    .selectOption("En Familia");
  await page
    .getByRole("button", { name: "Guardar celda", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(3);
  await f.succeed(2);
  await expect(page.locator("table")).toContainText("Acceso familiar");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("Diario edits scores, impressions, and comments with one active editor", async ({
  page,
}) => {
  const f = await setup(page, "remembered");
  await page.goto("./?tab=journal&year=all");
  await page
    .locator("table .journal-review-summary")
    .getByRole("button", {
      name: "Editar Reseña de Inline fixture",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Reseña", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("spinbutton", { name: "Reseña", exact: true })
    .fill("91");
  await page
    .getByRole("button", { name: "Guardar celda", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await f.succeed(0);
  await page
    .getByRole("button", {
      name: "Editar Impresiones de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Impresiones", exact: true })
    .fill("Increíble");
  await page
    .getByRole("textbox", { name: "Impresiones", exact: true })
    .press("Enter");
  await expect.poll(() => f.pending.length).toBe(2);
  await f.succeed(1);
  await page
    .getByRole("button", {
      name: "Editar Comentarios adicionales de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Comentarios adicionales", exact: true })
    .fill("A longer review\nWith a second line");
  await page
    .getByRole("textbox", { name: "Comentarios adicionales", exact: true })
    .press("Control+Enter");
  await expect.poll(() => f.pending.length).toBe(3);
  await f.succeed(2);
  await expect(page.locator("table")).toContainText("A longer review");
  await page.screenshot({
    path: "test-results/inline-diario.png",
    fullPage: true,
  });
});
test("Próximos supports seasons, exact dates, and Hype inline", async ({
  page,
}) => {
  const f = await setup(page, "upcoming");
  await page.goto("./?tab=upcoming");
  await page
    .getByRole("button", {
      name: "Editar Lanzamiento de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "Tipo de lanzamiento", exact: true })
    .selectOption("season");
  await page
    .getByRole("textbox", { name: "Año de lanzamiento", exact: true })
    .fill("2027");
  await page
    .getByRole("combobox", { name: "Temporada de lanzamiento", exact: true })
    .selectOption("winter");
  await page.screenshot({
    path: "test-results/inline-upcoming-edit.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Guardar celda", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  expect(f.pending[0].request().postDataJSON()).toMatchObject({
    release: "2027-winter",
    year: 2027,
  });
  await f.succeed(0);
  await page
    .getByRole("button", { name: "Editar Hype de Inline fixture", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Hype", exact: true })
    .selectOption("Hyper");
  await page
    .getByRole("button", { name: "Guardar celda", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(2);
  await f.succeed(1);
  await expect(page.locator("table")).toContainText("Hyper");
});
test("Ctrl+Z undoes saved edits in order without replacing native text undo", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .getByRole("button", {
      name: "Editar Hs. jugadas de Inline fixture",
      exact: true,
    })
    .click();
  const hours = page.getByRole("spinbutton", {
    name: "Hs. jugadas",
    exact: true,
  });
  await hours.fill("12.5");
  await hours.press("Enter");
  await expect.poll(() => f.pending.length).toBe(1);
  await f.succeed(0);
  await page
    .getByRole("button", {
      name: "Editar Comentarios adicionales de Inline fixture",
      exact: true,
    })
    .click();
  const notes = page.getByRole("textbox", {
    name: "Comentarios adicionales",
    exact: true,
  });
  await notes.fill("New comment");
  await notes.press("Control+z");
  expect(f.pending).toHaveLength(1);
  await notes.fill("New comment");
  await notes.press("Control+Enter");
  await expect.poll(() => f.pending.length).toBe(2);
  await f.succeed(1);
  await expect(
    page.getByRole("button", { name: "Deshacer", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Deshacer", exact: true }).focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => f.pending.length).toBe(3);
  expect(f.pending[2].request().postDataJSON()).toMatchObject({
    notes: "Original comment",
    hours: 12.5,
  });
  await f.succeed(2);
  await expect(
    page.getByRole("button", { name: "Deshacer", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Deshacer", exact: true }).focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => f.pending.length).toBe(4);
  expect(f.pending[3].request().postDataJSON()).toMatchObject({
    notes: "Original comment",
    hours: null,
  });
  await f.succeed(3);
});
test("mobile still opens the full editor when a game is tapped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .locator(".mobile-games")
    .getByText("Inline fixture", { exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Tu partida" })).toBeVisible();
});

test("undo refuses to replace a field changed elsewhere after the inline save", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .getByRole("button", {
      name: "Editar Hs. jugadas de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("spinbutton", { name: "Hs. jugadas", exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "Guardar celda", exact: true })
    .click();
  await expect.poll(() => f.pending.length).toBe(1);
  await f.succeed(0);
  f.serverUpdate({ hours: 20, updated_at: "2026-10-23T15:00:00Z" });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("table .library-playthrough")).toContainText(
    "20 h",
  );
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Este dato cambió después de tu edición" }),
  ).toBeVisible();
  expect(f.pending).toHaveLength(1);
});

test("unchanged cells dismiss outside or switch directly to another field without saving", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  const title = page.getByRole("button", {
    name: "Editar Nombre de Inline fixture",
    exact: true,
  });
  const consoleButton = page.getByRole("button", {
    name: "Editar Consola de Inline fixture",
    exact: true,
  });
  await title.click();
  await page.getByRole("heading", { name: "Biblioteca.", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveCount(0);
  await title.click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("  Inline fixture  ");
  await consoleButton.click();
  await expect(
    page.getByRole("combobox", { name: "Consola", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Ver detalles de Inline fixture",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog", { name: "Tu partida" })).toBeVisible();
  expect(f.pending).toHaveLength(0);
});
test("equivalent date and number formats close outside while changed or invalid drafts remain", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .getByRole("button", {
      name: "Editar Empecé de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Empecé", exact: true })
    .fill("2026-01-01");
  await page.getByRole("heading", { name: "Biblioteca.", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Empecé", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Editar Reseña de Inline fixture",
      exact: true,
    })
    .click();
  await page
    .getByRole("spinbutton", { name: "Reseña", exact: true })
    .fill("80.00");
  await page.getByRole("heading", { name: "Biblioteca.", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Reseña", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Editar Nombre de Inline fixture",
      exact: true,
    })
    .click();
  const input = page.getByRole("textbox", { name: "Nombre", exact: true });
  await input.fill("Changed");
  await page.getByRole("heading", { name: "Biblioteca.", exact: true }).click();
  await expect(input).toHaveValue("Changed");
  await input.fill("");
  await page.getByRole("heading", { name: "Biblioteca.", exact: true }).click();
  await expect(input).toHaveValue("");
  await input.fill("Inline fixture");
  await page.getByRole("heading", { name: "Biblioteca.", exact: true }).click();
  await expect(input).toHaveCount(0);
  expect(f.pending).toHaveLength(0);
});

test("Enter on Cancel discards the draft while Enter on Save saves once", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  const title = () =>
    page.getByRole("button", {
      name: "Editar Nombre de Inline fixture",
      exact: true,
    });
  await title().click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Accidental change");
  const cancel = page.getByRole("button", {
    name: "Cancelar celda",
    exact: true,
  });
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveCount(0);
  expect(f.pending).toHaveLength(0);
  await expect(title()).toHaveText("Inline fixture");

  await title().click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Intentional change");
  await page
    .getByRole("button", { name: "Guardar celda", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => f.pending.length).toBe(1);
  await f.succeed(0);
  await expect(
    page.locator("table").getByText("Intentional change", { exact: true }),
  ).toBeVisible();
  expect(f.pending).toHaveLength(1);
});

test("inline short years normalize on blur and save with the full year", async ({
  page,
}) => {
  const f = await setup(page);
  await page.goto("./?tab=library&year=all");
  await page
    .getByRole("button", {
      name: "Editar Empecé de Inline fixture",
      exact: true,
    })
    .click();
  const input = page.getByRole("textbox", { name: "Empecé", exact: true });
  await input.fill("02/01/26");
  await input.blur();
  await expect(input).toHaveValue("02/01/2026");
  await input.focus();
  await input.press("Enter");
  await expect.poll(() => f.pending.length).toBe(1);
  expect(f.pending[0].request().postDataJSON()).toMatchObject({
    started: "02/01/2026",
    period: "2026",
  });
  await f.succeed(0);
  await expect(
    page.getByRole("button", {
      name: "Editar Empecé de Inline fixture",
      exact: true,
    }),
  ).toHaveText("02/01/2026");
});
