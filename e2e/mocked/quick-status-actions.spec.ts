import { expect, test, type Locator, type Page } from "@playwright/test";
import { datesAfterStatusChange } from "../../src/lib/journal/entry-status";
import type { JournalEntry } from "../../src/lib/journal/journal-types";
import { emptyRecord, type Status } from "../../src/lib/types";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
const id = "20000000-0000-4000-8000-000000000001";
const base: JournalEntry = {
  ...emptyRecord,
  id,
  gameId: "30000000-0000-4000-8000-000000000001",
  title: "Quick status fixture",
  status: "wishlist",
  updated_at: "2026-11-11T10:00:00Z",
};
async function setup(
  page: Page,
  status: Status,
  dates: { started?: string; finished?: string } = {},
  fail = false,
) {
  let saved: JournalEntry = { ...base, ...dates, status };
  const submissions: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records") {
      if (route.request().method() === "POST") {
        const input = route.request().postDataJSON() as Record<string, unknown>;
        submissions.push(input);
        if (fail)
          return route.fulfill({
            status: 409,
            json: { error: "La entrada cambió. Actualizá los datos.", code: "CONFLICT" },
          });
        saved = {
          ...saved,
          ...input,
          ...datesAfterStatusChange(
            input as JournalEntry,
            saved,
            new Date("2026-11-11T17:00:00Z"),
          ),
          updated_at: "2026-11-11T10:01:00Z",
        };
        return route.fulfill({ json: { id, gameId: saved.gameId, record: saved } });
      }
      return route.fulfill({
        json: { records: [saved], member: { display_name: "Fixture", role: "member" } },
      });
    }
    if (path === "/api/offers") return route.fulfill({ json: [] });
    return route.fulfill({
      json:
        path === "/api/notifications"
          ? { items: [], unreadCount: 0, nextCursor: null, checkedAt: new Date().toISOString() }
          : path === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : path === "/api/backups"
              ? { checkedAt: new Date().toISOString(), latest: null, lastSuccess: null }
              : [],
    });
  });
  await page.goto(`./?tab=${status === "wishlist" ? "wishlist" : "library"}&year=all`);
  await page
    .getByRole("button", { name: "Editar rápidamente " + base.title, exact: true })
    .click();
  return {
    submissions,
    getSaved: () => saved,
    panel: page.getByRole("dialog", { name: "Edición rápida", exact: true }),
  };
}

async function expectStatusActionAligned(panel: Locator, action: string) {
  const select = await panel.getByLabel("Estado", { exact: true }).boundingBox();
  const button = await panel.getByRole("button", { name: action, exact: true }).boundingBox();
  const row = await panel.locator(".quick-editor-status-row").boundingBox();
  expect(select).not.toBeNull();
  expect(button).not.toBeNull();
  expect(row).not.toBeNull();
  expect(Math.abs(select!.y - button!.y), `select top=${select!.y}, button top=${button!.y}`).toBeLessThanOrEqual(1);
  expect(
    Math.abs(select!.y + select!.height - (button!.y + button!.height)),
    `select bottom=${select!.y + select!.height}, button bottom=${button!.y + button!.height}`,
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(row!.x + row!.width - (button!.x + button!.width)), "button right edge should meet the status grid's second-column edge").toBeLessThanOrEqual(1);
}

test("Empezar saves playing and preserves typed quick fields while the server fills a missing start date", async ({ page }) => {
  const fixture = await setup(page, "wishlist");
  await fixture.panel.getByLabel("Prioridad", { exact: true }).fill("Alta");
  await page.screenshot({ path: "test-results/quick-status-actions-right-mobile.png", fullPage: true });
  await expectStatusActionAligned(fixture.panel, "Empezar");
  await fixture.panel.getByRole("button", { name: "Empezar", exact: true }).click();
  await expect.poll(() => fixture.submissions.length).toBe(1);
  expect(fixture.submissions[0]).toMatchObject({
    status: "playing",
    priority: "Alta",
    notes: base.notes,
    updated_at: base.updated_at,
  });
  expect(fixture.getSaved().started).toBe("2026-11-11");
  await expect(fixture.panel).toHaveCount(0);
});

test("Retomar preserves an existing start date", async ({ page }) => {
  const fixture = await setup(page, "paused", { started: "12/08/2024" });
  await page.setViewportSize({ width: 1024, height: 900 });
  await expectStatusActionAligned(fixture.panel, "Retomar");
  await fixture.panel.getByRole("button", { name: "Retomar", exact: true }).click();
  await expect.poll(() => fixture.submissions.length).toBe(1);
  expect(fixture.submissions[0]).toMatchObject({ status: "playing", started: "12/08/2024" });
  expect(fixture.getSaved().started).toBe("12/08/2024");
});

test("Terminar completes a playing entry, preserves its start date, and fills only its missing finish date", async ({ page }) => {
  const fixture = await setup(page, "playing", { started: "12/08/2024" });
  await fixture.panel.getByRole("button", { name: "Terminar", exact: true }).click();
  await expect.poll(() => fixture.submissions.length).toBe(1);
  expect(fixture.submissions[0]).toMatchObject({ status: "completed", started: "12/08/2024" });
  expect(fixture.getSaved().started).toBe("12/08/2024");
  expect(fixture.getSaved().finished).toBe("2026-11-11");
  await expect(fixture.panel).toHaveCount(0);
});

test("a failed status action keeps the quick editor and its draft open", async ({ page }) => {
  const fixture = await setup(page, "wishlist", {}, true);
  await fixture.panel.getByLabel("Prioridad", { exact: true }).fill("Alta");
  await fixture.panel.getByRole("button", { name: "Empezar", exact: true }).click();
  await expect.poll(() => fixture.submissions.length).toBe(1);
  await expect(fixture.panel).toBeVisible();
  await expect(fixture.panel.getByLabel("Prioridad", { exact: true })).toHaveValue("Alta");
  await expect(fixture.panel.getByRole("alert")).toContainText("La entrada cambió. Actualizá los datos.");
});
