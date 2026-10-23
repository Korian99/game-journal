"use client";
import { useCallback, useEffect } from "react";
import { apiRequest } from "../lib/api-client";
import type { JournalNotification } from "../lib/contracts";
import type { JournalEntry } from "../lib/journal/journal-types";
import type { Offer } from "../lib/types";
import { notificationPageSchema } from "../lib/notifications/history";
import { notificationDestination } from "../lib/notifications/navigation";
import type { NotificationReadInput } from "../lib/notifications/read-state";
import type { useJournalLocation } from "./use-journal-location";

export function useNotificationNavigation({
  location,
  records,
  offers,
  recordsReady,
  online,
  readNotifications,
  setNotice,
  setError,
}: {
  location: Pick<
    ReturnType<typeof useJournalLocation>,
    | "notificationId"
    | "revealEntry"
    | "deferNotification"
    | "clearNotificationTarget"
  >;
  records: JournalEntry[];
  offers: Offer[];
  recordsReady: boolean;
  online: boolean;
  readNotifications: (
    input: NotificationReadInput,
    unreadDelta: number,
  ) => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
}) {
  const {
    notificationId,
    revealEntry,
    deferNotification,
    clearNotificationTarget,
  } = location;
  const openNotification = useCallback(
    (notification: JournalNotification) => {
      if (!recordsReady) {
        deferNotification(notification.id);
        return;
      }
      const destination = notificationDestination(
        notification,
        records,
        offers,
      );
      revealEntry(destination.view, destination.entryId);
      if (!destination.entryId && notification.kind !== "test")
        setNotice("Este juego ya no está en las entradas activas.");
      if (!notification.read_at && online)
        void readNotifications({ ids: [notification.id] }, 1).catch(
          () => undefined,
        );
    },
    [
      records,
      offers,
      recordsReady,
      revealEntry,
      deferNotification,
      online,
      readNotifications,
      setNotice,
    ],
  );
  useEffect(() => {
    if (!notificationId || !recordsReady || !online) return;
    let active = true;
    void apiRequest(
      "/api/notifications?" + new URLSearchParams({ id: notificationId }),
      "GET",
      undefined,
      notificationPageSchema,
    )
      .then((page) => {
        if (!active) return;
        const notification = page.items.find(
          (item) => item.id === notificationId,
        );
        if (notification) openNotification(notification);
        else {
          clearNotificationTarget();
          setNotice("La notificación ya no está disponible.");
        }
      })
      .catch((failure: unknown) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "No se pudo abrir la notificación.",
          );
      });
    return () => {
      active = false;
    };
  }, [
    notificationId,
    recordsReady,
    online,
    openNotification,
    clearNotificationTarget,
    setNotice,
    setError,
  ]);
  return openNotification;
}
