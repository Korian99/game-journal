import { openFullGame } from "./open-full-game";
import { test, expect, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
for (const mobile of [false, true]) {
  test(
    (mobile ? "mobile" : "desktop") +
      " saves a changed Objetivo and the game with one click",
    async ({ page }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const record = {
        ...emptyRecord,
        id: "20000000-0000-4000-8000-000000000001",
        gameId: "30000000-0000-4000-8000-000000000001",
        title: "Target fixture",
        status: "wishlist",
      };
      const offer = {
        id: "40000000-0000-4000-8000-000000000001",
        game_id: record.gameId,
        store: "steam",
        url: "https://store.steampowered.com/app/620/",
        region: "AR",
        currency: "USD",
        price: 20,
        regular_price: 20,
        discount: 0,
        watched: true,
        target_price: 10 as number | null,
        status: "available",
        checked_at: "2026-10-23T10:00:00Z",
        error: null,
      };
      const patches: Route[] = [],
        saves: Route[] = [];
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/offers") {
          if (route.request().method() === "PATCH") {
            patches.push(route);
            return;
          }
          return route.fulfill({ json: [offer] });
        }
        if (path === "/api/records") {
          if (route.request().method() === "POST") {
            saves.push(route);
            return;
          }
          return route.fulfill({
            json: {
              records: [record],
              member: { role: "member", display_name: "Fixture" },
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
      const open = async () => {
        await openFullGame(page, record.title);
      };
      await open();
      const dialog = page.getByRole("dialog", { name: "Tu partida" });
      const target = dialog.getByLabel("Objetivo (USD)", { exact: true });
      await target.fill("8");
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Descartar cambios" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Seguir editando" }).click();
      expect(patches).toHaveLength(0);
      await target.focus();
      await dialog
        .getByRole("button", { name: "Guardar entrada", exact: true })
        .click();
      await expect.poll(() => patches.length).toBe(1);
      await expect(dialog.getByRole("status")).toHaveText("Guardando entrada…");
      expect(saves).toHaveLength(0);
      expect(patches[0].request().postDataJSON()).toEqual({
        id: offer.id,
        target_price: 8,
      });
      if (mobile) {
        await patches[0].fulfill({
          status: 503,
          json: { error: "No se pudo guardar el Objetivo", code: "TEMPORARY" },
        });
        await expect(dialog.getByRole("alert")).toContainText(
          "No se pudo guardar el Objetivo",
        );
        await expect(target).toHaveValue("8");
        await expect(target).toBeEnabled();
        expect(saves).toHaveLength(0);
        await dialog
          .getByRole("button", { name: "Guardar entrada", exact: true })
          .click();
        await expect.poll(() => patches.length).toBe(2);
      }
      offer.target_price = 8;
      await patches.at(-1)!.fulfill({ json: { ok: true } });
      await expect.poll(() => saves.length).toBe(1);
      await saves[0].fulfill({
        json: {
          id: record.id,
          gameId: record.gameId,
          record: { ...record, ...saves[0].request().postDataJSON() },
        },
      });
      await expect(dialog).toHaveCount(0);
      await open();
      await expect(target).toHaveValue("8");
      expect(patches).toHaveLength(mobile ? 2 : 1);
    },
  );
}
