import { expect, it } from "vitest";
import {
  notificationDestination,
  notificationHref,
} from "../src/lib/notifications/navigation";
import { emptyRecord } from "../src/lib/types";
const gameId = "30000000-0000-4000-8000-000000000001";
const event = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "Offer",
  body: "",
  kind: "discount" as const,
  game_id: gameId,
  created_at: "2026-10-23T10:00:00Z",
  read_at: null,
  url: "/?tab=wishlist",
};
const played = {
  ...emptyRecord,
  id: "played",
  gameId,
  status: "completed" as const,
};
it("prefers the event's tab when a game has multiple active entries", () => {
  const wishlist = { ...played, id: "wish", status: "wishlist" as const };
  const upcoming = { ...played, id: "soon", status: "upcoming" as const };
  expect(
    notificationDestination(event, [played, wishlist, upcoming], []),
  ).toEqual({ view: "wishlist", entryId: "wish" });
  expect(
    notificationDestination(
      { ...event, kind: "release" },
      [played, wishlist, upcoming],
      [],
    ),
  ).toEqual({ view: "upcoming", entryId: "soon" });
});
it("follows a game that moved to a played view and supports offer-only events", () => {
  expect(notificationDestination(event, [played], [])).toEqual({
    view: "library",
    entryId: "played",
  });
  expect(
    notificationDestination(event, [{ ...played, status: "remembered" }], []),
  ).toEqual({ view: "journal", entryId: "played" });
  expect(
    notificationDestination(
      { ...event, game_id: null, offer_id: "offer" },
      [played],
      [{ id: "offer", game_id: gameId }],
    ),
  ).toEqual({ view: "library", entryId: "played" });
});
it("does not invent matches for deleted or missing games, or test alerts", () => {
  expect(notificationDestination(event, [], [])).toEqual({
    view: "wishlist",
    entryId: "",
  });
  expect(
    notificationDestination({ ...event, kind: "test" }, [played], []),
  ).toEqual({ view: "settings", entryId: "" });
});
it("creates an internal deep link even if the stored URL is external", () => {
  expect(notificationHref({ ...event, url: "https://example.invalid" })).toBe(
    "/?tab=wishlist&notification=" + event.id,
  );
});
