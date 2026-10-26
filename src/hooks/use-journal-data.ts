"use client";
import {
  createNotificationReadGate,
  optimisticNotificationRead,
  type NotificationReadInput,
} from "@/lib/notifications/read-state";
import { mergeSavedEntry } from "@/lib/journal/inline-editing";
import { notificationPageSchema } from "@/lib/notifications/history";
import { browserClient } from "@/lib/supabase/client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { apiRequest, createResource } from "@/lib/api-client";
import {
  recordsResponseSchema,
  offersSchema,
  sharingResponseSchema,
  saveResponseSchema,
  type SharingData,
} from "@/lib/contracts";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { Offer } from "@/lib/types";

export function useJournalData() {
  const notificationReadGate = useMemo(() => createNotificationReadGate(), []);
  const [notificationReadsPending, setNotificationReadsPending] = useState(0);
  const resources = useMemo(
    () => ({
      records: createResource<ReturnType<typeof recordsResponseSchema.parse>>(
        { records: [], member: null },
        () =>
          apiRequest(
            "/api/records?includeOffers=false",
            "GET",
            undefined,
            recordsResponseSchema,
          ),
      ),
      offers: createResource<Offer[]>([], () =>
        apiRequest("/api/offers", "GET", undefined, offersSchema),
      ),
      sharing: createResource<SharingData>(
        { shared: [], members: [], grants: [] },
        () =>
          apiRequest("/api/sharing", "GET", undefined, sharingResponseSchema),
      ),
      notifications: createResource<
        ReturnType<typeof notificationPageSchema.parse>
      >(
        { items: [], unreadCount: 0, nextCursor: null, checkedAt: "" },
        async () => {
          await notificationReadGate.wait();
          return apiRequest(
            "/api/notifications",
            "GET",
            undefined,
            notificationPageSchema,
          );
        },
      ),
    }),
    [notificationReadGate],
  );
  const recordsState = useSyncExternalStore(
    resources.records.subscribe,
    resources.records.getSnapshot,
    resources.records.getSnapshot,
  );
  const offersState = useSyncExternalStore(
    resources.offers.subscribe,
    resources.offers.getSnapshot,
    resources.offers.getSnapshot,
  );
  const sharingState = useSyncExternalStore(
    resources.sharing.subscribe,
    resources.sharing.getSnapshot,
    resources.sharing.getSnapshot,
  );
  const notificationsState = useSyncExternalStore(
    resources.notifications.subscribe,
    resources.notifications.getSnapshot,
    resources.notifications.getSnapshot,
  );
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true);
  const readNotifications = useCallback(
    async (input: NotificationReadInput, unreadDelta: number) => {
      if ("allBefore" in input && notificationReadGate.pending())
        throw Error("Esperá a que se guarden las lecturas pendientes.");
      const finish = notificationReadGate.begin();
      setNotificationReadsPending(notificationReadGate.pending());
      setError("");
      const update = optimisticNotificationRead(
        resources.notifications.getSnapshot().data,
        input,
        unreadDelta,
      );
      resources.notifications.setData(update.data);
      const historyUpdates = notificationReadGate.preview(input, unreadDelta);
      try {
        await apiRequest("/api/notifications", "PATCH", input);
      } catch (failure) {
        resources.notifications.setData(
          update.rollback(resources.notifications.getSnapshot().data),
        );
        historyUpdates.forEach((update) => update.rollback());
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudo marcar la notificación como leída.",
        );
        throw failure;
      } finally {
        finish();
        setNotificationReadsPending(notificationReadGate.pending());
        if (!notificationReadGate.pending())
          resources.notifications.invalidate();
        historyUpdates.forEach((update) => update.refresh());
      }
    },
    [notificationReadGate, resources],
  );
  const reloadJournal = useCallback(async () => {
    await Promise.all(
      Object.values(resources).map((resource) => resource.load()),
    );
  }, [resources]);
  useEffect(() => {
    document.documentElement.classList.toggle(
      "light",
      localStorage.getItem("journal-theme") === "light",
    );
    setOnline(navigator.onLine);
    void reloadJournal();
    const db = browserClient();
    const queued = new Set<keyof typeof resources>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (...names: (keyof typeof resources)[]) => {
      names.forEach((name) => queued.add(name));
      clearTimeout(timer);
      timer = setTimeout(() => {
        queued.forEach((name) => resources[name].invalidate());
        queued.clear();
      }, 150);
    };
    const channel = db
      .channel("journal-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playthroughs" },
        () => schedule("records"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => schedule("records"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers" },
        () => schedule("offers"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_entries" },
        () => schedule("sharing"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => schedule("notifications"),
      )
      .subscribe();
    const connected = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void reloadJournal();
    };
    const focused = () => {
      if (navigator.onLine) void reloadJournal();
    };
    window.addEventListener("online", connected);
    window.addEventListener("offline", connected);
    window.addEventListener("focus", focused);
    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", connected);
      window.removeEventListener("focus", focused);
    };
  }, [reloadJournal, resources]);
  async function performAction(
    operation: () => Promise<unknown>,
    successMessage?: string,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      const saved = saveResponseSchema.safeParse(result);
      if (saved.success && saved.data.record) {
        const entry = saved.data.record;
        const current = resources.records.getSnapshot().data;
        resources.records.setData({
          ...current,
          records: [
            ...current.records.filter((record) => record.id !== entry.id),
            entry,
          ],
        });
      }
      if (successMessage) setNotice(successMessage);
      await reloadJournal();
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo completar la operación.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const acceptRecord = useCallback(
    (entry: JournalEntry) => {
      const current = resources.records.getSnapshot().data;
      resources.records.setData({
        ...current,
        records: mergeSavedEntry(current.records, entry),
      });
      resources.records.invalidate();
    },
    [resources],
  );
  const resourceStates = {
    records: recordsState,
    offers: offersState,
    sharing: sharingState,
    notifications: notificationsState,
  };
  const warnings = Object.entries(resourceStates)
    .filter(([, state]) => state.error)
    .map(([name, state]) => ({
      name,
      message: state.error,
      stale: state.checkedAt !== null,
    }));
  return {
    records: recordsState.data.records,
    offers: offersState.data,
    member: recordsState.data.member,
    sharing: sharingState.data,
    notifications: notificationsState.data.items,
    unreadCount: notificationsState.checkedAt
      ? notificationsState.data.unreadCount
      : null,
    notificationsCheckedAt: notificationsState.checkedAt,
    notificationPageCheckedAt: notificationsState.data.checkedAt,
    notificationReadsPending: notificationReadsPending > 0,
    waitForNotificationReads: notificationReadGate.wait,
    observeNotificationReads: notificationReadGate.observe,
    readNotifications,
    loading:
      !recordsState.data.records.length &&
      (recordsState.status === "idle" || recordsState.status === "loading"),
    error,
    notice,
    busy,
    online,
    warnings,
    resourceStates,
    setBusy,
    setError,
    setNotice,
    reloadJournal,
    performAction,
    removeRecord: (id: string) => {
      const current = resources.records.getSnapshot().data;
      resources.records.setData({
        ...current,
        records: current.records.filter((record) => record.id !== id),
      });
      const sharing = resources.sharing.getSnapshot().data;
      resources.sharing.setData({
        ...sharing,
        grants: sharing.grants.filter((grant) => grant.entry_id !== id),
      });
    },
    acceptRecord,
    reloadRecords: resources.records.load,
    getRecord: (id: string) =>
      resources.records
        .getSnapshot()
        .data.records.find((entry) => entry.id === id),
    replaceRecords: (records: JournalEntry[]) =>
      resources.records.setData({
        ...resources.records.getSnapshot().data,
        records,
      }),
  };
}
