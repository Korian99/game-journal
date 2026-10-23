import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
test("Mejor consola requires five games and combines emulator labels under filters", async ({
  page,
}) => {
  const records = [
    "Emulacion",
    "Emulators",
    "GBA Emulator",
    "PSP Emulator",
    "Emulador",
    ...Array(4).fill("PC"),
  ].map((device, index) => ({
    ...emptyRecord,
    id: "20000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
    gameId: "30000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
    title: "Game " + index,
    device,
    period: "2024",
    status: index === 0 ? "playing" : "completed",
    rating: index < 5 ? 80 : 100,
  }));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/api/records"
          ? { records, member: { display_name: "Fixture", role: "member" } }
          : path === "/api/notifications"
            ? {
                items: [],
                unreadCount: 0,
                nextCursor: null,
                checkedAt: new Date().toISOString(),
              }
            : path === "/api/sharing"
              ? { shared: [], members: [], grants: [] }
              : path === "/api/backups/drive"
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
                : path === "/api/backups"
                  ? {
                      checkedAt: new Date().toISOString(),
                      lastSuccess: null,
                      latest: null,
                    }
                  : [],
    });
  });

  await page.goto("./?tab=journal&year=all");
  const tile = page.locator('[data-stat="best-console"]');
  await expect(tile.locator("strong")).toHaveText("Emulador");
  await expect(tile).toContainText("MEJOR CONSOLA");
  await expect(tile).toContainText("5 juegos");
  await expect(tile).toContainText("80");
  await page.getByLabel("Filtrar estado").selectOption("completed");
  await expect(tile.locator("strong")).toHaveText("—");
  await expect(tile).toContainText("Sin datos suficientes");
  await page.goto("./?tab=journal&year=all&platform=GBA%20Emulator");
  await expect(page.getByLabel("Filtrar plataforma")).toHaveValue("Emulador");
  await expect(page.locator("table .game-data-row")).toHaveCount(5);
  await expect(tile.locator("strong")).toHaveText("Emulador");
});
