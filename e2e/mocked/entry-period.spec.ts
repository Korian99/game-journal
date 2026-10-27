import { openFullGame } from "./open-full-game";
import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
for (const mobile of [false, true])
  test(
    (mobile ? "mobile" : "desktop") +
      " derives a period while editing play dates",
    async ({ page }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const record = {
        ...emptyRecord,
        id: "20000000-0000-4000-8000-000000000001",
        gameId: "30000000-0000-4000-8000-000000000001",
        title: "Period fixture",
        status: "wishlist",
      };
      let saved: typeof record | null = null;
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/records") {
          if (route.request().method() === "POST") {
            saved = route.request().postDataJSON();
            return route.fulfill({
              json: { id: record.id, gameId: record.gameId, record: saved },
            });
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
                      latest: null,
                      lastSuccess: null,
                    }
                  : [],
        });
      });
      await page.goto("./?tab=wishlist");
      await openFullGame(page, record.title);
      const dialog = page.getByRole("dialog", { name: "Tu partida" });
      await dialog.getByRole("tab", { name: "Partida", exact: true }).click();
      const started = dialog.getByLabel("Empecé", { exact: true });
      await started.fill("31/12/25");
      await started.blur();
      await expect(started).toHaveValue("31/12/2025");
      await dialog.getByRole("tab", { name: "Más", exact: true }).click();
      await expect(
        dialog.getByLabel("Año o período jugado", { exact: true }),
      ).toHaveValue("2025");
      await dialog.getByRole("tab", { name: "Partida", exact: true }).click();
      const finished = dialog.getByLabel("Terminé", { exact: true });
      await finished.fill("");
      await finished.pressSequentially("01/01/2026");
      await expect(finished).toHaveValue("01/01/2026");
      await dialog.getByRole("tab", { name: "Más", exact: true }).click();
      await expect(
        dialog.getByLabel("Año o período jugado", { exact: true }),
      ).toHaveValue("2025-2026");
      await dialog
        .getByRole("button", { name: "Guardar entrada", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      expect(saved).toMatchObject({
        period: "2025-2026",
        status: "completed",
        started: "31/12/2025",
        finished: "01/01/2026",
      });
    },
  );
