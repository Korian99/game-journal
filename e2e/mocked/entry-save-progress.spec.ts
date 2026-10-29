import { test, expect, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
for (const editing of [true, false]) {
  test(
    (editing ? "editing" : "mobile creation") +
      " shows save progress, prevents repeats and preserves a failed draft",
    async ({ page }) => {
      if (!editing) await page.setViewportSize({ width: 390, height: 844 });
      const initial = {
        ...emptyRecord,
        id: "20000000-0000-4000-8000-000000000001",
        gameId: "30000000-0000-4000-8000-000000000001",
        title: "Existing game",
        status: "wishlist",
        updated_at: "2026-10-23T10:00:00Z",
      };
      let records = editing ? [initial] : [];
      let saved = false;
      const posts: Route[] = [],
        refreshes: Route[] = [];
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/records") {
          if (route.request().method() === "POST") {
            posts.push(route);
            return;
          }
          if (saved) {
            refreshes.push(route);
            return;
          }
          return route.fulfill({
            json: {
              records,
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
                  checkedAt: "2026-10-23T10:00:00Z",
                }
              : path === "/api/sharing"
                ? { shared: [], members: [], grants: [] }
                : path === "/api/backups"
                  ? {
                      checkedAt: "2026-10-23T10:00:00Z",
                      lastSuccess: null,
                      latest: null,
                    }
                  : [],
        });
      });
      await page.goto("./?tab=wishlist");
      if (editing)
        await page
          .getByRole("button", {
            name: "Ver detalles de " + "Existing game",
            exact: true,
          })
          .click();
      else {
        await page
          .getByRole("button", { name: "Agregar juego", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Completar manualmente", exact: true })
          .click();
      }
      const dialog = page.getByRole("dialog", {
        name: editing ? "Tu partida" : "Agregar un juego",
      });
      const name = dialog.getByLabel("Nombre del juego", { exact: true });
      await name.fill("Saved draft");
      await dialog
        .getByRole("button", { name: "Guardar entrada", exact: true })
        .click();
      await expect.poll(() => posts.length).toBe(1);
      await expect(dialog.getByRole("status")).toHaveText("Guardando entrada…");
      await expect(
        dialog.getByRole("button", { name: "Guardando…", exact: true }),
      ).toBeDisabled();
      await expect(name).toBeDisabled();
      await expect(dialog.locator(".entry-editor-fields")).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await dialog
        .locator("form[id]")
        .evaluate((form) => (form as HTMLFormElement).requestSubmit());
      expect(posts).toHaveLength(1);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
      await expect(dialog).toBeVisible();
      await dialog.screenshot({
        path:
          "test-results/save-progress-" +
          (editing ? "desktop" : "mobile") +
          ".png",
      });
      if (!editing) {
        await posts[0].fulfill({
          status: 503,
          json: { error: "No se pudo guardar. Reintentá.", code: "TEMPORARY" },
        });
        await expect(dialog.getByRole("status")).toHaveCount(0);
        await expect(name).toBeEnabled();
        await expect(name).toHaveValue("Saved draft");
        await expect(dialog.getByRole("alert")).toContainText(
          "No se pudo guardar",
        );
        await dialog
          .getByRole("button", { name: "Guardar entrada", exact: true })
          .click();
        await expect.poll(() => posts.length).toBe(2);
      }
      const post = posts.at(-1)!;
      const canonical = {
        ...initial,
        ...post.request().postDataJSON(),
        updated_at: "2026-10-23T11:00:00Z",
      };
      records = [canonical];
      saved = true;
      await post.fulfill({
        json: { id: initial.id, gameId: initial.gameId, record: canonical },
      });
      await expect.poll(() => refreshes.length).toBeGreaterThan(0);
      await expect(dialog.getByRole("status")).toHaveText("Guardando entrada…");
      await refreshes[0].fulfill({
        json: { records, member: { display_name: "Fixture", role: "member" } },
      });
      await expect(dialog).toHaveCount(0);
      const successNotice = page
        .getByRole("status")
        .filter({ hasText: "Entrada guardada." });
      await expect(successNotice).toBeVisible();
      await expect(successNotice).toHaveCount(0, { timeout: 4000 });
    },
  );
}
