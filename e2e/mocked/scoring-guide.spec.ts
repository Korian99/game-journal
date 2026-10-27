import { openFullGame } from "./open-full-game";
import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";
import { defaultScoringGuide } from "../../src/lib/scoring-guide";

test("personal scoring guide is editable, persists, and opens from a review on mobile", async ({
  page,
}) => {
  let entries = [
    { score_threshold: 100, meaning: "Un juego perfecto" },
    { score_threshold: 0, meaning: "Ofensivamente malo" },
  ];
  let failSave = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/scoring") {
      if (route.request().method() === "PUT") {
        if (failSave)
          return route.fulfill({
            status: 503,
            json: { error: "No se pudo guardar", code: "TEMPORARY" },
          });
        entries = route.request().postDataJSON().entries;
      }
      return route.fulfill({ json: { entries } });
    }
    return route.fulfill({
      json:
        path === "/api/records"
          ? {
              records: [
                {
                  ...emptyRecord,
                  id: "20000000-0000-4000-8000-000000000001",
                  gameId: "30000000-0000-4000-8000-000000000001",
                  title: "Scoring fixture",
                  status: "remembered",
                  period: "2024",
                  rating: 95,
                },
              ],
              member: { display_name: "Fixture", role: "member" },
            }
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
  await page.goto("./?tab=settings");
  const guide = page.getByRole("region", {
    name: "Guía de reseñas",
    exact: true,
  });
  await expect(
    guide.getByText("Un juego perfecto", { exact: true }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Editar guía" }).click();
  await guide
    .getByLabel("Significado 1", { exact: true })
    .fill("Mi máximo puntaje");
  failSave = true;
  await guide.getByRole("button", { name: "Guardar guía" }).click();
  await expect(guide.getByRole("alert")).toHaveText("No se pudo guardar");
  await expect(guide.getByLabel("Significado 1", { exact: true })).toHaveValue(
    "Mi máximo puntaje",
  );
  failSave = false;
  await guide.getByRole("button", { name: "Guardar guía" }).click();
  await expect(
    guide.getByText("Mi máximo puntaje", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    guide.getByText("Mi máximo puntaje", { exact: true }),
  ).toBeVisible();
  await page.goto("./?tab=journal");
  await page.setViewportSize({ width: 390, height: 844 });
  await openFullGame(page, "Scoring fixture");
  const editor = page.getByRole("dialog");
  await editor.getByRole("tab", { name: "Reseña" }).click();
  await editor
    .getByRole("button", { name: "Guía de reseñas", exact: true })
    .click();
  const guideDialog = page.getByRole("dialog", {
    name: "Guía de reseñas",
    exact: true,
  });
  await expect(
    guideDialog.getByText("Mi máximo puntaje", { exact: true }),
  ).toBeVisible();
  await guideDialog
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(editor.getByLabel("Reseña / 100", { exact: true })).toHaveValue(
    "95",
  );
});

test("the full initial scale is readable on mobile and validates editable thresholds", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/api/scoring"
          ? { entries: defaultScoringGuide }
          : path === "/api/records"
            ? {
                records: [],
                member: { display_name: "Fixture", role: "member" },
              }
            : path === "/api/notifications"
              ? {
                  items: [],
                  unreadCount: 0,
                  nextCursor: null,
                  checkedAt: new Date().toISOString(),
                }
              : path === "/api/sharing"
                ? { shared: [], members: [], grants: [] }
                : [],
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?tab=settings");
  const guide = page.getByRole("region", {
    name: "Guía de reseñas",
    exact: true,
  });
  await expect(guide.locator("dt")).toHaveCount(11);
  await expect(
    guide.getByText("Ofensivamente malo", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/scoring-guide-mobile.png",
    fullPage: true,
  });
  await guide.getByRole("button", { name: "Editar guía", exact: true }).click();
  await guide.getByLabel("Puntaje 1", { exact: true }).fill("90");
  await guide
    .getByRole("button", { name: "Guardar guía", exact: true })
    .click();
  await expect(guide.getByRole("alert")).toContainText("una sola vez");
  page.once("dialog", (dialog) => dialog.dismiss());
  await guide.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(guide.getByLabel("Puntaje 1", { exact: true })).toHaveValue(
    "90",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await guide.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(guide.locator("dt")).toHaveCount(11);
});
