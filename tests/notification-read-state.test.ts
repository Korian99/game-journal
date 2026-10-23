import { expect, it } from "vitest";
import {
  optimisticNotificationRead,
  createNotificationReadGate,
} from "../src/lib/notifications/read-state";
const item = (
  id: string,
  created_at = "2026-10-21T10:00:00Z",
  read_at: string | null = null,
) => ({
  id,
  title: id,
  body: "Oferta",
  kind: "discount" as const,
  url: "/",
  created_at,
  read_at,
});
const page = {
  items: [item("a"), item("b"), item("c", undefined, "2026-10-22T10:00:00Z")],
  unreadCount: 345,
  nextCursor: "older",
  checkedAt: "2026-10-23T11:00:00Z",
};
it("updates the exact total for a paginated item and rolls back only its own change", () => {
  const a = optimisticNotificationRead(
    page,
    { ids: ["a"] },
    1,
    "2026-10-23T12:00:00Z",
  );
  const b = optimisticNotificationRead(
    a.data,
    { ids: ["b"] },
    1,
    "2026-10-23T12:00:01Z",
  );
  const rollback = a.rollback(b.data);
  expect(rollback.unreadCount).toBe(344);
  expect(rollback.items[0].read_at).toBeNull();
  expect(rollback.items[1].read_at).not.toBeNull();
  expect(rollback.items[2]).toEqual(page.items[2]);
  const older = optimisticNotificationRead(page, { ids: ["not-in-head"] }, 1);
  expect(older.data.unreadCount).toBe(344);
  expect(older.rollback(older.data).unreadCount).toBe(345);
});
it("bulk read preserves notifications newer than its cutoff and never counts blanks as read", () => {
  const input = {
    ...page,
    items: [...page.items, item("new", "2026-10-23T13:00:00Z")],
    unreadCount: 346,
  };
  const update = optimisticNotificationRead(
    input,
    { allBefore: page.checkedAt },
    346,
  );
  expect(update.data.unreadCount).toBe(1);
  expect(update.data.items[0].read_at).not.toBeNull();
  expect(update.data.items[3].read_at).toBeNull();
  expect(update.rollback(update.data)).toEqual(input);
});
it("holds refreshes until every pending read finishes", async () => {
  const gate = createNotificationReadGate();
  const endA = gate.begin(),
    endB = gate.begin();
  let loaded = false;
  const load = gate.wait().then(() => {
    loaded = true;
  });
  endA();
  await Promise.resolve();
  expect(loaded).toBe(false);
  endA();
  expect(gate.pending()).toBe(1);
  endB();
  await load;
  expect(loaded).toBe(true);
  expect(gate.pending()).toBe(0);
});
