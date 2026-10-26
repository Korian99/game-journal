import { test, expect } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

test("the editor saves status dates without list quick actions", async ({
  page,
}) => {
  let record = {
    ...emptyRecord,
    id: "20000000-0000-4000-8000-000000000001",
    gameId: "30000000-0000-4000-8000-000000000001",
    title: "Automatic date fixture",
    status: "wishlist",
    updated_at: "2026-10-21T10:00:00Z",
  };
  const submissions: (typeof record)[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/records") {
      if (route.request().method() === "POST") {
        const input = route.request().postDataJSON() as typeof record;
        submissions.push(input);
        // Fixed canonical server responses; calendar calculation is covered by API tests.
        record = {
          ...record,
          ...input,
          started: "2026-10-22",
          finished: input.status === "completed" ? "2026-10-22" : "",
          updated_at:
            "2026-10-22T" +
            (input.status === "completed" ? "12" : "11") +
            ":00:00Z",
        };
        return route.fulfill({
          json: { id: record.id, gameId: record.gameId, record },
        });
      }
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
          : url.pathname === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : url.pathname === "/api/backups"
              ? {
                  checkedAt: new Date().toISOString(),
                  latest: null,
                  lastSuccess: null,
                }
              : [],
    });
  });
  await page.goto("./?tab=wishlist");
  await expect(page.locator(".quick-actions")).toHaveCount(0);
  await expect(page.locator("table th").filter({ hasText: /^$/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", {
      name: "Ver detalles de " + record.title,
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Estado", { exact: true })
    .selectOption("playing");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(submissions[0].status).toBe("playing");
  expect(submissions[0].started).toBe("");

  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  const table = page.locator("table");
  await expect(
    table
      .locator(".library-playthrough")
      .getByText("22/10/2026", { exact: true }),
  ).toBeVisible();
  await table
    .getByRole("button", {
      name: "Ver detalles de " + record.title,
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Estado", { exact: true })
    .selectOption("completed");
  await page
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => submissions.length).toBe(2);
  expect(submissions[1].started).toBe("2026-10-22");
  expect(submissions[1].finished).toBe("");
  await expect(
    table
      .locator(".library-finish-reason")
      .getByText("22/10/2026", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".quick-actions")).toHaveCount(0);
  await page.locator(".mobile-game").filter({ hasText: record.title }).click();
  await page.getByRole("tab", { name: "Partida", exact: true }).click();
  await expect(page.getByLabel("Empecé", { exact: true })).toHaveValue(
    "22/10/2026",
  );
  await expect(page.getByLabel("Terminé", { exact: true })).toHaveValue(
    "22/10/2026",
  );
});
