import { it, expect } from "vitest";
import {
  notificationQuery,
  notificationPage,
} from "../src/lib/notifications/history";
it("paginates ties using timestamp and ID and validates cursor before query interpolation", () => {
  const rows = Array.from({ length: 26 }, (_, i) => ({
    id: "10000000-0000-4000-8000-" + String(100000000000 + i),
    title: "Fixture",
    body: "",
    created_at: "2026-10-21T10:00:00.123456+00:00",
    read_at: null,
    kind: "discount",
    url: "/",
  }));
  const page = notificationPage(rows, 345, "2026-10-21T12:00:00Z");
  expect(page.items).toHaveLength(25);
  expect(page.unreadCount).toBe(345);
  expect(
    notificationQuery(new URLSearchParams({ cursor: page.nextCursor! })).cursor
      ?.id,
  ).toBe(rows[24].id);
  expect(() =>
    notificationQuery(
      new URLSearchParams({
        cursor: '{"at":"bad),owner_id.eq.bad","id":"bad"}',
      }),
    ),
  ).toThrow();
});
