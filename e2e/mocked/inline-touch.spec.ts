import { expect, test, type Page, type Route } from "@playwright/test";
import { emptyRecord } from "../../src/lib/types";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

const record = {
  ...emptyRecord,
  id: "20000000-0000-4000-8000-000000000001",
  gameId: "30000000-0000-4000-8000-000000000001",
  title: "Touch fixture",
  status: "completed",
  period: "2026",
  notes: "Original review",
  reason: "Keep reason",
  updated_at: "2026-11-17T10:00:00Z",
};

async function setup(page: Page, longNotes = false) {
  await page.addInitScript(() =>
    localStorage.setItem("journal-library-layout", "notebook"),
  );
  let saved = {
    ...record,
    notes: longNotes
      ? Array.from({ length: 18 }, (_, index) => `Review line ${index + 1}`).join("\n")
      : record.notes,
  };
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/records" && route.request().method() === "POST") {
      const input = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(input);
      saved = { ...saved, ...input, updated_at: "2026-11-17T10:01:00Z" };
      return route.fulfill({
        json: { id: saved.id, gameId: saved.gameId, record: saved },
      });
    }
    if (path === "/api/records")
      return route.fulfill({
        json: {
          records: [saved],
          member: { display_name: "Fixture", role: "member" },
        },
      });
    return route.fulfill({
      json:
        path === "/api/notifications"
          ? { items: [], unreadCount: 0, nextCursor: null, checkedAt: "2026-11-17T10:00:00Z" }
          : path === "/api/sharing"
            ? { shared: [], members: [], grants: [] }
            : path === "/api/backups"
              ? { checkedAt: "2026-11-17T10:00:00Z", latest: null, lastSuccess: null }
              : [],
    });
  });
  await page.goto("./?tab=library&year=all");
  await page
    .getByRole("navigation", { name: "Juegos de la Biblioteca" })
    .getByRole("button", { name: "Touch fixture" })
    .click();
  return { posts };
}

const noteTrigger = (page: Page) =>
  page
    .locator(".library-notebook-notes")
    .getByRole("button", {
      name: "Editar Comentarios adicionales de Touch fixture",
      exact: true,
    });

async function touch(page: Page, type: "touchStart" | "touchEnd" | "touchCancel", x: number, y: number) {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y }],
  });
  return session;
}

async function tap(page: Page, x: number, y: number) {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

test("the first touch marks a field and a delayed second tap opens and saves once", async ({ page }) => {
  const { posts } = await setup(page);
  const trigger = noteTrigger(page);
  await trigger.scrollIntoViewIfNeeded();
  const box = (await trigger.boundingBox())!;
  await tap(page, box.x + 12, box.y + 12);
  await expect(trigger).toHaveClass(/is-touch-selected/);
  await expect(page.locator(".inline-editor")).toHaveCount(0);
  expect(posts).toHaveLength(0);

  await page.waitForTimeout(2100);
  await tap(page, box.x + 12, box.y + 12);
  const input = page.getByRole("textbox", { name: "Comentarios adicionales", exact: true });
  await expect(input).toBeFocused();
  await input.fill("Updated review");
  await page.getByRole("button", { name: "Guardar celda", exact: true }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({
    notes: "Updated review",
    reason: "Keep reason",
    updated_at: record.updated_at,
  });
  await expect(input).toHaveCount(0);
  expect(posts).toHaveLength(1);
});

test("touching another field or outside disarms the prior field", async ({ page }) => {
  const { posts } = await setup(page);
  const trigger = noteTrigger(page);
  const reminder = page.locator(".library-notebook-reminder").getByRole("button", {
    name: "Editar Notas de Touch fixture",
    exact: true,
  });
  await trigger.scrollIntoViewIfNeeded();
  const firstBox = (await trigger.boundingBox())!;
  await tap(page, firstBox.x + 12, firstBox.y + 12);
  await expect(trigger).toHaveClass(/is-touch-selected/);

  await reminder.scrollIntoViewIfNeeded();
  const reminderBox = (await reminder.boundingBox())!;
  await tap(page, reminderBox.x + 12, reminderBox.y + 12);
  await expect(reminder).toHaveClass(/is-touch-selected/);
  await expect(trigger).not.toHaveClass(/is-touch-selected/);
  await expect(page.locator(".inline-editor")).toHaveCount(0);

  await page.getByRole("heading", { name: "Biblioteca", exact: true }).click();
  await expect(reminder).not.toHaveClass(/is-touch-selected/);
  expect(posts).toHaveLength(0);
});

test("touch movement and cancellation prevent touch activation", async ({ page }) => {
  const { posts } = await setup(page);
  const trigger = noteTrigger(page);
  await trigger.scrollIntoViewIfNeeded();
  let box = (await trigger.boundingBox())!;
  let session = await touch(page, "touchStart", box.x + 12, box.y + 12);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + 30, y: box.y + 12 }],
  });
  await page.waitForTimeout(550);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await trigger.dispatchEvent("click", { bubbles: true, detail: 1 });
  await expect(page.getByRole("textbox", { name: "Comentarios adicionales", exact: true })).toHaveCount(0);
  await expect(page.locator(".inline-editor")).toHaveCount(0);

  box = (await trigger.boundingBox())!;
  await trigger.scrollIntoViewIfNeeded();
  session = await touch(page, "touchStart", box.x + 12, box.y + 12);
  await page.waitForTimeout(550);
  await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await trigger.dispatchEvent("click", { bubbles: true, detail: 1 });
  await expect(page.getByRole("textbox", { name: "Comentarios adicionales", exact: true })).toHaveCount(0);
  await expect(page.locator(".inline-editor")).toHaveCount(0);
  await expect(trigger).toBeVisible();
  expect(posts).toHaveLength(0);
});

test("a vertical swipe on an inline trigger scrolls the notebook without editing", async ({ page }) => {
  const { posts } = await setup(page, true);
  const pagePane = page.locator(".library-notebook-page");
  const swipeTrigger = pagePane.locator(".library-notebook-page-heading h2 .inline-value");
  await swipeTrigger.scrollIntoViewIfNeeded();
  const swipeBox = (await swipeTrigger.boundingBox())!;
  const startX = swipeBox.x + swipeBox.width / 2;
  const startY = swipeBox.y + swipeBox.height / 2;
  const scrollBefore = await page.evaluate(() => {
    const pane = document.querySelector(".library-notebook-page")!;
    const root = document.scrollingElement!;
    return {
      windowRange: root.scrollHeight - root.clientHeight,
      paneRange: pane.scrollHeight - pane.clientHeight,
      offset: window.scrollY + pane.scrollTop,
    };
  });
  expect(Math.max(scrollBefore.windowRange, scrollBefore.paneRange)).toBeGreaterThan(100);
  const session = await touch(page, "touchStart", startX, startY);
  for (let step = 1; step <= 4; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: startX, y: startY - step * 35 }],
    });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() =>
    window.scrollY + document.querySelector(".library-notebook-page")!.scrollTop,
  )).toBeGreaterThan(scrollBefore.offset);
  await expect(page.locator(".inline-editor")).toHaveCount(0);
  expect(posts).toHaveLength(0);
});

test("keyboard and mouse activation remain available on a touch device", async ({ page }) => {
  const { posts } = await setup(page);
  const trigger = noteTrigger(page);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Comentarios adicionales", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancelar celda", exact: true }).click();
  await trigger.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("textbox", { name: "Comentarios adicionales", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancelar celda", exact: true }).click();
  await trigger.click();
  await expect(page.getByRole("textbox", { name: "Comentarios adicionales", exact: true })).toBeFocused();
  expect(posts).toHaveLength(0);
});
