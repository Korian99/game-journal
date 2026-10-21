import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
test("the library survives notification failure and protects unsaved edits", async ({
  page,
}) => {
  const record = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Library fixture",
    status: "playing",
    started: "2026-10-01",
    updated_at: "2026-10-21T10:00:00Z",
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records")
      return route.fulfill({
        json: {
          records: [record],
          member: {
            id: "10000000-0000-4000-8000-000000000001",
            display_name: "Fixture",
            role: "member",
          },
        },
      });
    if (url.pathname === "/api/notifications")
      return route.fulfill({
        status: 503,
        json: { error: "No se pudieron cargar los avisos", code: "TEMPORARY" },
      });
    if (url.pathname === "/api/notifications")
      return route.fulfill({
        json: {
          items: [],
          unreadCount: 0,
          nextCursor: null,
          checkedAt: new Date().toISOString(),
        },
      });
    if (url.pathname === "/api/offers") return route.fulfill({ json: [] });
    if (url.pathname === "/api/sharing")
      return route.fulfill({ json: { shared: [], members: [], grants: [] } });
    if (url.pathname === "/api/backups")
      return route.fulfill({
        json: {
          checkedAt: new Date().toISOString(),
          lastSuccess: null,
          latest: null,
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto("./?year=2026");
  await expect(
    page.locator("table").getByText("Library fixture", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Notificaciones" }),
  ).toBeVisible();
  await page
    .locator("table")
    .getByText("Library fixture", { exact: true })
    .click();
  await page
    .getByLabel("Nombre del juego", { exact: true })
    .fill("Unsaved title");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Descartar cambios" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(
    page.getByLabel("Nombre del juego", { exact: true }),
  ).toHaveValue("Unsaved title");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Descartar cambios", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("a successful save stays successful when the following refresh fails", async ({
  page,
}) => {
  let saved = false;
  const record = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Save fixture",
    status: "playing",
    started: "2026-10-01",
    updated_at: "2026-10-21T10:00:00Z",
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records") {
      if (route.request().method() === "POST") {
        saved = true;
        return route.fulfill({
          json: {
            id: record.id,
            gameId: record.gameId,
            record: {
              ...record,
              ...route.request().postDataJSON(),
              updated_at: "2026-10-21T11:00:00Z",
            },
          },
        });
      }
      return saved
        ? route.fulfill({
            status: 503,
            json: { error: "Refresh failed", code: "TEMPORARY" },
          })
        : route.fulfill({
            json: {
              records: [record],
              member: { display_name: "Fixture", role: "member" },
            },
          });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  lastSuccess: null,
                  latest: null,
                }
              : [],
    });
  });
  await page.goto("./?year=2026");
  await page
    .locator("table")
    .getByText("Save fixture", { exact: true })
    .click();
  await page
    .getByLabel("Nombre del juego", { exact: true })
    .fill("Saved new title");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("table").getByText("Saved new title", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Entrada guardada" }),
  ).toBeVisible();
});

test("a failed save preserves the shared draft and supports keyboard tab navigation", async ({
  page,
}) => {
  const record = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Conflict fixture",
    status: "playing",
    started: "2026-10-01",
    updated_at: "2026-10-21T10:00:00Z",
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records") {
      if (route.request().method() === "POST")
        return route.fulfill({
          status: 409,
          json: {
            error: "La entrada cambió en otro dispositivo.",
            code: "CONFLICT",
          },
        });
      return route.fulfill({
        json: {
          records: [record],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === "/api/notifications"
          ? {
              items: [],
              unreadCount: 0,
              nextCursor: null,
              checkedAt: new Date().toISOString(),
            }
          : url.pathname === "/api/backups/drive"
            ? {
                configured: false,
                connected: false,
                state: "disconnected",
                folderId: null,
                errorCode: null,
                recoveryVerifiedAt: null,
                latest: null,
                lastSuccess: null,
                checkedAt: new Date().toISOString(),
              }
            : url.pathname === "/api/sharing"
              ? { shared: [], members: [], grants: [] }
              : url.pathname === "/api/backups"
                ? {
                    checkedAt: new Date().toISOString(),
                    lastSuccess: null,
                    latest: null,
                  }
                : [],
    });
  });
  await page.goto("./?year=2026");
  const quick = page.locator("table .quick-actions");
  await quick.getByLabel("Acciones rápidas de Conflict fixture").click();
  await quick.getByLabel("Prioridad", { exact: true }).fill("3");
  await quick
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(quick.getByRole("alert")).toContainText("No se guardó");
  await expect(quick.getByLabel("Prioridad", { exact: true })).toHaveValue("3");
  await quick.getByLabel("Acciones rápidas de Conflict fixture").click();
  await page
    .locator("table")
    .getByText("Conflict fixture", { exact: true })
    .click();
  await page.getByRole("tab", { name: "Principal", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Partida", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Reseña", exact: true }).click();
  await page
    .getByLabel("Comentarios adicionales · privados")
    .fill("Keep this draft");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "La entrada cambió",
  );
  await expect(
    page.getByLabel("Comentarios adicionales · privados"),
  ).toHaveValue("Keep this draft");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Descartar cambios" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(
    page.getByLabel("Comentarios adicionales · privados"),
  ).toHaveValue("Keep this draft");
});
