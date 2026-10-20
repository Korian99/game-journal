"use client";
import { browserClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api-client";
import type { JournalEntry } from "../lib/journal/journal-types";
import { emptyRecord, type Offer } from "../lib/types";

export function useJournalData() {
  const [records, setRecords] = useState<JournalEntry[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<any>(null);
  const [sharing, setSharing] = useState<any>({
    shared: [],
    members: [],
    grants: [],
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const reloadJournal = useCallback(async () => {
    try {
      const [data, shared, alerts] = await Promise.all([
        apiRequest("/api/records"),
        apiRequest("/api/sharing"),
        apiRequest("/api/push"),
      ]);
      setRecords(data.records.map((r: any) => ({ ...emptyRecord, ...r })));
      setOffers(data.offers);
      setMember(data.member);
      setSharing(shared);
      setNotifications(alerts);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle(
      "light",
      localStorage.getItem("journal-theme") === "light",
    );
    reloadJournal();
    const db = browserClient();
    const channel = db
      .channel("journal-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playthroughs" },
        () => reloadJournal(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers" },
        () => reloadJournal(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_entries" },
        () => reloadJournal(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => reloadJournal(),
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [reloadJournal]);
  async function performAction(
    operation: () => Promise<unknown>,
    successMessage?: string,
  ) {
    setBusy(true);
    setError("");
    try {
      await operation();
      if (successMessage) setNotice(successMessage);
      await reloadJournal();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    records,
    offers,
    loading,
    error,
    notice,
    busy,
    member,
    sharing,
    notifications,
    setBusy,
    setError,
    setNotice,
    reloadJournal,
    performAction,
  };
}
