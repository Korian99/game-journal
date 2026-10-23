import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

const longComment =
  "Z — La narrativa y los personajes hacen que el viaje sea memorable. El combate permite probar estrategias distintas y descubrir combinaciones nuevas sin perder el ritmo de la historia.\n\nLos escenarios, la música y los pequeños detalles acompañan muy bien la experiencia. Un comentario largo debería poder leerse de corrido, con sus párrafos intactos.";
for (const view of ["library", "journal"]) {
  test(
    view + " shows full-width comments beneath each game on desktop and mobile",
    async ({ page }) => {
      const records = [
        { title: "FINAL FANTASY VII", notes: longComment },
        { title: "Alfa fixture", notes: "A — Un comentario breve." },
        { title: "Sin comentarios", notes: "" },
        { title: "Solo espacios", notes: "  \n  " },
      ].map((value, index) => ({
        ...emptyRecord,
        ...value,
        status: "completed",
        period: "2024",
        id: "20000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
        gameId:
          "30000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
        started: "2026-10-" + String(20 - index).padStart(2, "0"),
        finished: "2026-10-22",
        device: "PC",
        hours: 30,
        estimated: "37 - 50 - 81",
        rating: 94 - index,
        impression: "Increíble",
        memorability: 9,
        reason:
          "La historia y el combate me motivaron a seguir hasta el final.",
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
                  : path === "/api/backups"
                    ? {
                        checkedAt: new Date().toISOString(),
                        latest: null,
                        lastSuccess: null,
                      }
                    : [],
        });
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("./?tab=" + view + "&year=all");
      const table = page.locator("table");
      await expect(
        table.getByRole("columnheader", {
          name: "Comentarios adicionales",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(table.locator(".game-data-row")).toHaveCount(4);
      await expect(table.locator(".game-comments-row")).toHaveCount(2);
      const main = table
        .locator(".game-data-row")
        .filter({ hasText: "FINAL FANTASY VII" });
      const comments = main.locator("xpath=following-sibling::tr[1]");
      await expect(comments).toHaveClass(/game-comments-row/);
      expect(await comments.locator("td").getAttribute("colspan")).toBe(
        String(await table.locator("th").count()),
      );
      expect(await comments.locator(".game-comments-text").textContent()).toBe(
        longComment,
      );
      const tableBox = (await table.boundingBox())!;
      const commentBox = (await comments
        .locator(".game-comments")
        .boundingBox())!;
      expect(commentBox.width).toBeGreaterThan(tableBox.width * 0.9);
      await page.locator(".table-scroll").screenshot({
        path: "test-results/" + view + "-comments-desktop.png",
      });
      if (view === "library")
        await page
          .getByLabel("Ordenar Biblioteca", { exact: true })
          .selectOption("notes.asc");
      else await page.goto("./?tab=journal&year=all&sort=notes.asc");
      await expect(table.locator(".game-comments-text").first()).toHaveText(
        "A — Un comentario breve.",
      );
      await expect(table.locator(".game-comments-text").last()).toHaveText(
        longComment,
      );
      await page.setViewportSize({ width: 1000, height: 900 });
      expect(
        await page
          .locator(".table-scroll")
          .evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
      await page.locator(".table-scroll").screenshot({
        path: "test-results/" + view + "-comments-narrow.png",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      const card = page
        .locator(".mobile-game-wrapper")
        .filter({ hasText: "FINAL FANTASY VII" });
      await expect(card.locator(".game-comments")).toHaveCount(1);
      expect(await card.locator(".game-comments-text").textContent()).toBe(
        longComment,
      );
      const cardBox = (await card.boundingBox())!;
      const mobileComment = (await card
        .locator(".game-comments")
        .boundingBox())!;
      const infoBox = (await card.locator(".mobile-game-info").boundingBox())!;
      expect(mobileComment.width).toBeGreaterThan(cardBox.width * 0.85);
      expect(mobileComment.y).toBeGreaterThanOrEqual(
        infoBox.y + infoBox.height,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await card.screenshot({
        path: "test-results/" + view + "-comments-mobile.png",
      });
      await card.locator(".mobile-game").click();
      await page.getByRole("tab", { name: "Reseña", exact: true }).click();
      await expect(
        page.getByRole("textbox", {
          name: "Comentarios adicionales · privados",
          exact: true,
        }),
      ).toHaveValue(longComment);
    },
  );
}
