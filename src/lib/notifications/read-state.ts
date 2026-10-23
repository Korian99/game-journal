import type { notificationPageSchema } from "./history";
export type NotificationReadInput = { ids: string[] } | { allBefore: string };
export type NotificationReadUpdate = {
  rollback: () => void;
  refresh: () => void;
};
export type ObserveNotificationReads = (
  observer: (
    input: NotificationReadInput,
    unreadDelta: number,
  ) => NotificationReadUpdate | null,
) => () => void;
type NotificationPage = ReturnType<typeof notificationPageSchema.parse>;

/** Keep refresh responses behind pending writes so old unread data cannot flash back. */
export function createNotificationReadGate() {
  const observers = new Set<Parameters<ObserveNotificationReads>[0]>();
  let pending = 0;
  let settled: Promise<void> = Promise.resolve();
  let resolve: (() => void) | undefined;
  return {
    pending: () => pending,
    observe: ((observer) => {
      observers.add(observer);
      return () => {
        observers.delete(observer);
      };
    }) as ObserveNotificationReads,
    preview: (input: NotificationReadInput, unreadDelta: number) =>
      [...observers].flatMap((observer) => {
        const update = observer(input, unreadDelta);
        return update ? [update] : [];
      }),
    begin() {
      if (!pending)
        settled = new Promise<void>((done) => {
          resolve = done;
        });
      pending++;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        if (!--pending) resolve?.();
      };
    },
    async wait() {
      while (pending) await settled;
    },
  };
}

/** Undo only this action, preserving other read clicks and already-read notifications. */
export function optimisticNotificationRead(
  page: NotificationPage,
  input: NotificationReadInput,
  unreadDelta: number,
  markedAt = new Date().toISOString(),
) {
  const ids = "ids" in input ? new Set(input.ids) : null;
  const cutoff = "allBefore" in input ? Date.parse(input.allBefore) : null;
  const matches = (item: NotificationPage["items"][number]) =>
    !item.read_at &&
    (ids ? ids.has(item.id) : Date.parse(item.created_at) <= cutoff!);
  const affected = new Set(page.items.filter(matches).map((item) => item.id));
  const newer =
    cutoff === null
      ? 0
      : page.items.filter(
          (item) => !item.read_at && Date.parse(item.created_at) > cutoff,
        ).length;
  const decrement = Math.max(
    0,
    Math.min(unreadDelta, page.unreadCount - newer),
  );
  return {
    data: {
      ...page,
      unreadCount: page.unreadCount - decrement,
      items: page.items.map((item) =>
        affected.has(item.id) ? { ...item, read_at: markedAt } : item,
      ),
    },
    rollback: (current: NotificationPage): NotificationPage => ({
      ...current,
      unreadCount: current.unreadCount + decrement,
      items: current.items.map((item) =>
        affected.has(item.id) && item.read_at === markedAt
          ? { ...item, read_at: null }
          : item,
      ),
    }),
  };
}
