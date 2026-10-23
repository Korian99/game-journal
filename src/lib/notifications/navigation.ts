import type { JournalNotification } from "../contracts";
import type { JournalEntry } from "../journal/journal-types";
import type { JournalView } from "../journal/journal-location";
import { dateOrder } from "../journal/view-config";
import type { Offer } from "../types";

export function notificationTab(
  kind: JournalNotification["kind"],
): JournalView {
  return kind === "release"
    ? "upcoming"
    : kind === "test"
      ? "settings"
      : "wishlist";
}
export function notificationHref(notification: JournalNotification): string {
  return (
    "/?" +
    new URLSearchParams({
      tab: notificationTab(notification.kind),
      notification: notification.id,
    })
  );
}
export function notificationDestination(
  notification: JournalNotification,
  records: JournalEntry[],
  offers: Pick<Offer, "id" | "game_id">[],
): { view: JournalView; entryId: string } {
  const preferred = notificationTab(notification.kind);
  if (preferred === "settings") return { view: preferred, entryId: "" };
  const gameId =
    notification.game_id ??
    offers.find((offer) => offer.id === notification.offer_id)?.game_id;
  const matches = gameId
    ? records.filter((record) => record.gameId === gameId)
    : [];
  const entry =
    matches.find((record) => record.status === preferred) ??
    matches.sort(
      (a, b) =>
        (dateOrder(b.started) ?? -Infinity) -
          (dateOrder(a.started) ?? -Infinity) ||
        (dateOrder(b.finished) ?? -Infinity) -
          (dateOrder(a.finished) ?? -Infinity) ||
        (a.id ?? "").localeCompare(b.id ?? ""),
    )[0];
  if (!entry) return { view: preferred, entryId: "" };
  const view =
    entry.status === "wishlist" || entry.status === "upcoming"
      ? entry.status
      : entry.status === "remembered"
        ? "journal"
        : "library";
  return { view, entryId: entry.id ?? "" };
}
