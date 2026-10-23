import { test, expect } from "@playwright/test";
import { emptyRecord, statuses } from "../../src/lib/types";
test("Diario combines reviews, includes played states, and persists its status filter", async ({
  page,
}) => {
  const variants = [
    {
      title: "Reseña preferida",
      status: "playing",
      rating: 86,
      memorability: 10,
      impression: "9.5",
    },
    {
      title: "Recuerdo con impresiones",
      status: "remembered",
      rating: null,
      memorability: 2,
      impression: "8",
    },
    {
      title: "Terminado cero",
      status: "completed",
      rating: 0,
      memorability: 10,
      impression: "Olvidable",
    },
    {
      title: "En pausa fixture",
      status: "paused",
      rating: null,
      memorability: 9,
      impression: "Pendiente de seguir",
    },
    {
      title: "Sin terminar fixture",
      status: "abandoned",
      rating: 40,
      memorability: 4,
      impression: "Repetitivo",
    },
    { title: "Deseo oculto", status: "wishlist" },
    { title: "Próximo oculto", status: "upcoming" },
  ] as const;
  const records = variants.map((variant, index) => ({
    ...emptyRecord,
    ...variant,
    id: "20000000-0000-4000-8000-" + String(100000000000 + index),
    gameId: "30000000-0000-4000-8000-" + String(100000000000 + index),
    period: "2024",
    device: "PC",
    hours: 12,
    notes: "Comentarios privados " + index,
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?tab=journal&year=all");
  const table = page.locator("table");
  await expect(table.locator(".game-data-row")).toHaveCount(5);
  await expect(
    page.getByRole("columnheader", { name: "Valoración" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Memorabilidad", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Impresiones", exact: true }),
  ).toHaveCount(0);
  for (const item of variants.slice(0, 5)) {
    const row = table
      .locator(".game-data-row")
      .filter({ has: page.getByText(item.title, { exact: true }) });
    await expect(row.locator(".status")).toHaveText(statuses[item.status]);
  }
  const rated = table
    .locator("tr")
    .filter({ has: page.getByText("Reseña preferida", { exact: true }) });
  await expect(
    rated.getByLabel("Reseña: 86/100", { exact: true }),
  ).toBeVisible();
  await expect(rated.locator(".journal-review-summary")).toContainText(
    "Memorabilidad: 10/10",
  );
  await expect(rated.locator(".journal-review-summary")).toContainText(
    "Impresiones: 9.5",
  );
  await expect(
    table.getByLabel("Impresiones: 80/100", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByLabel("Reseña: 0/100", { exact: true }),
  ).toBeVisible();
  const textOnly = table
    .locator("tr")
    .filter({ has: page.getByText("En pausa fixture", { exact: true }) });
  await expect(
    textOnly.getByLabel("Sin valoración", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Valoración", exact: true }).click();
  await expect(table.locator(".game-data-row").first()).toContainText(
    "Reseña preferida",
  );
  expect(
    await page
      .locator(".table-scroll")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/diario-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Filtrar estado").selectOption("paused");
  await expect(table.locator(".game-data-row")).toHaveCount(1);
  await expect(page).toHaveURL(/status=paused/);
  await page.reload();
  await expect(page.getByLabel("Filtrar estado")).toHaveValue("paused");
  await expect(table.locator(".game-data-row")).toHaveCount(1);
  await page.getByLabel("Filtrar estado").selectOption("");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.locator(".mobile-games");
  await expect(
    mobile.getByLabel("Impresiones: 80/100", { exact: true }),
  ).toBeVisible();
  const card = mobile
    .locator(".mobile-game-wrapper")
    .filter({ hasText: "Reseña preferida" });
  await expect(card.locator(".journal-review-summary")).toContainText(
    "Reseña: 86/100",
  );
  await expect(card.locator(".status")).toHaveText("Jugando");
  await expect(
    card.getByText("Hs. jugadas: 12 h", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/diario-mobile.png",
    fullPage: true,
  });
});
