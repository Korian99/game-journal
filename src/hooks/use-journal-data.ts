"use client";
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
      >({ items: [], unreadCount: 0, nextCursor: null, checkedAt: "" }, () =>
        apiRequest(
          "/api/notifications",
          "GET",
          undefined,
          notificationPageSchema,
        ),
      ),
    }),
    [],
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
    replaceRecords: (records: JournalEntry[]) =>
      resources.records.setData({
        ...resources.records.getSnapshot().data,
        records,
      }),
  };
}
