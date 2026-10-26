import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
for (const failRefresh of [false, true]) {
  test(
    "confirmed deletion supports undo and restore" +
      (failRefresh ? " after a failed refresh" : ""),
    async ({ page }) => {
      const entry = {
        ...emptyRecord,
        id: "20000000-0000-4000-8000-000000000001",
        gameId: "30000000-0000-4000-8000-000000000001",
        title: "Recovery UI fixture",
        status: "playing",
        started: "2026-10-01",
        notes: "Review to preserve",
        updated_at: "2026-10-21T10:00:00Z",
      };
      let records = [entry],
        trash: (typeof entry & { deleted_at: string })[] = [];
      await page.route("**/api/**", async (route) => {
        const url = new URL(route.request().url()),
          method = route.request().method();
        if (url.pathname === "/api/records") {
          if (method === "DELETE") {
            trash = [{ ...entry, deleted_at: "2026-10-21T11:00:00Z" }];
            records = [];
            return route.fulfill({ json: { ok: true } });
          }
          if (failRefresh && trash.length)
            return route.fulfill({
              status: 503,
              json: { error: "Record refresh unavailable", code: "TEMPORARY" },
            });
          return route.fulfill({
            json: {
              records,
              member: { display_name: "Fixture", role: "member" },
            },
          });
        }
        if (url.pathname === "/api/trash") {
          if (method === "PATCH") {
            records = [entry];
            trash = [];
            return route.fulfill({ json: { ok: true } });
          }
          return route.fulfill({ json: trash });
        }
        if (url.pathname === "/api/backups/drive")
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
      async function remove() {
        await page
          .getByRole("button", {
            name: "Ver detalles de " + entry.title,
            exact: true,
          })
          .click();
        await page.getByRole("button", { name: "Opciones del juego" }).click();
        await page
          .getByRole("button", { name: "Eliminar entrada", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Confirmar eliminación", exact: true })
          .click();
      }
      await remove();
      await expect(page.locator("table")).toHaveCount(0);
      await page.getByRole("button", { name: "Deshacer", exact: true }).click();
      await expect(
        page.locator("table").getByText(entry.title, { exact: true }),
      ).toBeVisible();
      await remove();
      await page
        .getByRole("button", { name: "Configuración", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Papelera", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Restaurar", exact: true })
        .click();
      await expect(
        page.getByText("La papelera está vacía.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Biblioteca", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Ver detalles de " + entry.title,
          exact: true,
        })
        .click();
      await page.getByRole("tab", { name: "Reseña", exact: true }).click();
      await expect(
        page.getByLabel("Comentarios adicionales · privados"),
      ).toHaveValue(entry.notes);
    },
  );
}
