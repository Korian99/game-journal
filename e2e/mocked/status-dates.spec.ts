import { openFullGame } from "./open-full-game";
import { test, expect, type Page } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

async function fixture(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-22T02:00:00Z"));
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
          started: input.started || (input.status === "playing" ? "2026-10-22" : ""),
          finished: input.finished || (input.status === "completed" ? "2026-10-22" : ""),
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
  await openFullGame(page, record.title);
  return submissions;
}

for (const mobile of [false, true]) {
  test(`${mobile ? "mobile" : "desktop"} synchronizes status and play dates before save`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const submissions = await fixture(page);
    const dialog = page.getByRole("dialog", { name: "Tu partida" });
    const principal = () =>
      dialog.getByRole("tab", { name: "Principal", exact: true }).click();
    const playthrough = () =>
      dialog.getByRole("tab", { name: "Partida", exact: true }).click();
    const status = dialog.getByLabel("Estado", { exact: true });
    const started = dialog.getByLabel("Empecé", { exact: true });
    const finished = dialog.getByLabel("Terminé", { exact: true });
    await status.selectOption("playing");
    await playthrough();
    await expect(started).toHaveValue("21/10/2026");
    await started.focus();
    await started.blur();
    await principal();
    await status.selectOption("completed");
    await playthrough();
    await expect(finished).toHaveValue("21/10/2026");
    await principal();
    await status.selectOption("wishlist");
    await playthrough();
    await expect(started).toHaveValue("");
    await expect(finished).toHaveValue("");
    expect(submissions).toHaveLength(0);

    await started.fill("20/10/25");
    await started.blur();
    await principal();
    await expect(status).toHaveValue("playing");
    await playthrough();
    await started.fill("");
    await started.blur();
    await principal();
    await expect(status).toHaveValue("wishlist");
    await playthrough();
    await started.fill("20/10/25");
    await started.fill("20/10");
    await started.blur();
    await principal();
    await expect(status).toHaveValue("wishlist");
    await playthrough();
    await started.fill("20/10/25");
    await started.blur();
    await finished.fill("21/10/25");
    await finished.blur();
    await principal();
    await expect(status).toHaveValue("completed");
    await status.selectOption("paused");
    await playthrough();
    await expect(started).toHaveValue("20/10/2025");
    await expect(finished).toHaveValue("21/10/2025");
    await principal();
    await expect(status).toHaveValue("paused");
    await dialog
      .getByRole("button", { name: "Guardar entrada", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(submissions[0]).toMatchObject({
      status: "paused",
      started: "20/10/2025",
      finished: "21/10/2025",
      period: "2025",
    });
  });
}

test("status preview submits blank manual dates and displays the canonical saved date", async ({
  page,
}) => {
  const submissions = await fixture(page);
  const dialog = page.getByRole("dialog", { name: "Tu partida" });
  await dialog.getByLabel("Estado", { exact: true }).selectOption("playing");
  await dialog.getByRole("tab", { name: "Partida", exact: true }).click();
  await expect(dialog.getByLabel("Empecé", { exact: true })).toHaveValue(
    "21/10/2026",
  );
  await dialog
    .getByRole("button", { name: "Guardar entrada", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(submissions[0]).toMatchObject({
    status: "playing",
    started: "",
    finished: "",
  });
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await expect(
    page
      .locator("table .library-playthrough")
      .getByText("22/10/2026", { exact: true }),
  ).toBeVisible();
});

for (const mobile of [false, true]) {
  test(`${mobile ? "mobile" : "desktop"} excludes Recuerdo from play-date synchronization`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const submissions = await fixture(page);
    const dialog = page.getByRole("dialog", { name: "Tu partida" });
    const status = dialog.getByLabel("Estado", { exact: true });
    const principal = () =>
      dialog.getByRole("tab", { name: "Principal", exact: true }).click();
    const playthrough = () =>
      dialog.getByRole("tab", { name: "Partida", exact: true }).click();
    const started = dialog.getByLabel("Empecé", { exact: true });
    const finished = dialog.getByLabel("Terminé", { exact: true });
    await status.selectOption("remembered");
    await playthrough();
    await expect(started).toHaveValue("");
    await expect(finished).toHaveValue("");
    await started.fill("20/10/2025");
    await finished.fill("21/10/2025");
    await finished.blur();
    await principal();
    await expect(status).toHaveValue("remembered");
    await playthrough();
    await started.fill("");
    await finished.fill("");
    await finished.blur();
    await principal();
    await expect(status).toHaveValue("remembered");
    await status.selectOption("wishlist");
    await playthrough();
    await started.fill("20/10/2025");
    await started.blur();
    await principal();
    await expect(status).toHaveValue("playing");
    await status.selectOption("remembered");
    await playthrough();
    await finished.fill("21/10/2025");
    await finished.blur();
    await principal();
    await expect(status).toHaveValue("remembered");
    await dialog
      .getByRole("button", { name: "Guardar entrada", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(submissions[0]).toMatchObject({
      status: "remembered",
      started: "20/10/2025",
      finished: "21/10/2025",
      period: "2025",
    });
  });
}
