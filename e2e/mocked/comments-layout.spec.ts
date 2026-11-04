import { openFullGame } from "./open-full-game";
import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

const longComment =
  "Z — La narrativa y los personajes hacen que el viaje sea memorable. El combate permite probar estrategias distintas y descubrir combinaciones nuevas sin perder el ritmo de la historia.\n\nLos escenarios, la música y los pequeños detalles acompañan muy bien la experiencia. Un comentario largo debería poder leerse de corrido, con sus párrafos intactos.";
for (const view of ["library", "journal"]) {
  test(
    view + " shows full-width comments beneath each game on desktop and mobile",
    async ({ page }) => {
      const records = [
        {
          title: "FINAL FANTASY VII",
          notes: longComment,
          cover: {
            provider: "nintendo",
            providerUrl:
              "https://assets.nintendo.com/image/upload/comments.jpg",
          },
        },
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
      await page.route("https://assets.nintendo.com/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320"><rect width="480" height="320" fill="#243b53"/><path d="M0 280 160 80l120 150 80-95 120 185H0Z" fill="#8fcfd1"/></svg>',
        }),
      );
      const previewRequests: string[] = [];
      await page.route("**/api/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === "/api/store-preview") {
          previewRequests.push((request.postDataJSON() as { url: string }).url);
          await new Promise((resolve) => setTimeout(resolve, 300));
          return route.fulfill({
            json: {
              url: "https://www.nintendo.com/es-ar/store/products/pokemon-legends-z-a-switch/",
              store: "nintendo",
              region: "AR",
              checkedAt: new Date().toISOString(),
              cover: {
                provider: "nintendo",
                providerUrl:
                  "https://assets.nintendo.com/image/upload/recovered.jpg",
              },
              fields: { title: "FINAL FANTASY VII" },
              quote: {
                status: "available",
                price: null,
                regular: null,
                currency: null,
                discount: 0,
              },
            },
          });
        }
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
      const entryGroup = main.locator("xpath=ancestor::tbody[1]");
      const art = main.locator(".game-row-art-wide");
      await expect(entryGroup).toHaveClass(/has-comments-art/);
      await expect(art).toHaveCount(1);
      await expect(art.locator("img")).toHaveAttribute("src", /comments\.jpg/);
      const groupBox = (await entryGroup.boundingBox())!;
      const mainBox = (await main.boundingBox())!;
      const commentsBox = (await comments.boundingBox())!;
      const artBox = (await art.boundingBox())!;
      expect(groupBox.y + groupBox.height).toBeCloseTo(
        commentsBox.y + commentsBox.height,
        0,
      );
      expect(artBox.y).toBeCloseTo(mainBox.y, 0);
      expect(artBox.y + artBox.height).toBeCloseTo(
        commentsBox.y + commentsBox.height,
        0,
      );
      expect(
        await art
          .locator("img")
          .evaluate((img) => (img as HTMLImageElement).naturalWidth > 0),
      ).toBe(true);
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
      const consoleLabel = main.locator(".inline-device");
      await expect(consoleLabel).toHaveText("PC");
      expect((await consoleLabel.boundingBox())!.height).toBeLessThanOrEqual(
        22,
      );
      await page.locator(".table-scroll").screenshot({
        path: "test-results/" + view + "-comments-narrow.png",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      const card = page
        .locator(".notebook-entry-card")
        .filter({ hasText: "FINAL FANTASY VII" });
      await expect(card.locator(".game-row-art img")).toHaveCount(1);
      await card.locator(".notebook-entry-reflections summary").click();
      await expect(card.locator(".game-comments")).toHaveCount(1);
      expect(await card.locator(".game-comments-text").textContent()).toBe(
        longComment,
      );
      const cardBox = (await card.boundingBox())!;
      const mobileComment = (await card
        .locator(".game-comments")
        .boundingBox())!;
      const info = card.locator(".notebook-entry-playthrough");
      const infoBox = (await info.boundingBox())!;
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
      records[1].cover = undefined;
      records[1].pages = [];
      await page.reload();
      await openFullGame(page, "Alfa fixture");
      const unavailableReset = page.getByRole("button", {
        name: "Restablecer portada de tienda",
      });
      await expect(unavailableReset).toBeEnabled();
      await unavailableReset.click();
      await expect(page.getByRole("alert")).toContainText(
        "No hay una página de tienda guardada",
      );
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();

      records[0].cover = undefined;
      records[0].pages = [
        "https://www.nintendo.com/es-ar/store/products/pokemon-legends-z-a-switch/",
      ];
      await page.reload();
      await openFullGame(page, "FINAL FANTASY VII");
      const resetCover = page.getByRole("button", {
        name: "Restablecer portada de tienda",
      });
      await expect(resetCover).toBeEnabled();
      await resetCover.click();
      await expect
        .poll(() => previewRequests)
        .toContain(
          "https://www.nintendo.com/es-ar/store/products/pokemon-legends-z-a-switch/",
        );
      await expect(page.locator(".cover-editor img")).toHaveAttribute(
        "src",
        "https://assets.nintendo.com/image/upload/recovered.jpg",
      );
      await expect(
        page.getByLabel("URL de portada", { exact: true }),
      ).toHaveValue("");
      await expect(page.getByRole("status")).toContainText(
        "Portada de tienda restablecida",
      );
      await page.locator(".cover-editor").screenshot({
        path: "test-results/" + view + "-cover-reset-feedback.png",
      });
      await resetCover.click();
      await expect(page.getByRole("status")).toContainText(
        "La portada ya es la de la tienda",
      );
      expect(previewRequests).toHaveLength(1);
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
