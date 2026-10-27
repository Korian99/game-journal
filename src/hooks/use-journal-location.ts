"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import {
  defaultJournalLocation,
  readJournalLocation,
  writeJournalLocation,
  type JournalLocation,
  type DiscountFilter,
  type ReviewFilter,
  type JournalView,
} from "../lib/journal/journal-location";

export function useJournalLocation(initialLocation?: JournalLocation) {
  const [state, setState] = useState(
    () => initialLocation ?? defaultJournalLocation(),
  );
  const current = useRef(state);
  const remembered = useRef(
    new Map<JournalView, JournalLocation>([[state.view, state]]),
  );
  const commit = useCallback(
    (next: JournalLocation, mode: "push" | "replace" = "push") => {
      const search = writeJournalLocation(next, window.location.search);
      const url =
        window.location.pathname + "?" + search + window.location.hash;
      if (
        url !==
        window.location.pathname + window.location.search + window.location.hash
      ) {
        if (mode === "push") window.history.pushState(null, "", url);
        else window.history.replaceState(null, "", url);
      }
      current.current = next;
      remembered.current.set(next.view, next);
      setState(next);
    },
    [],
  );
  useEffect(() => {
    const restore = () =>
      commit(readJournalLocation(window.location.search), "replace");
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [commit]);
  const update = useCallback(
    (patch: Partial<JournalLocation>, mode: "push" | "replace" = "push") => {
      commit({ ...current.current, ...patch }, mode);
    },
    [commit],
  );
  const setSort: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      update({
        sort:
          typeof updater === "function"
            ? updater(current.current.sort)
            : updater,
      });
    },
    [update],
  );
  const setView = useCallback(
    (view: JournalView) => {
      commit({
        ...(remembered.current.get(view) ?? defaultJournalLocation(view)),
        focusedEntry: "",
        notificationId: "",
      });
    },
    [commit],
  );
  const revealEntry = useCallback(
    (view: JournalView, entryId: string) => {
      const destination =
        remembered.current.get(view) ?? defaultJournalLocation(view);
      commit({
        ...destination,
        query: "",
        status: "",
        discount: "",
        review: "",
        platform: "",
        year: "",
        focusedEntry: entryId,
        notificationId: "",
        notificationOpen: false,
      });
    },
    [commit],
  );
  const deferNotification = useCallback(
    (notificationId: string) =>
      update({ notificationId, notificationOpen: false, focusedEntry: "" }),
    [update],
  );
  const clearNotificationTarget = useCallback(
    () => update({ notificationId: "" }, "replace"),
    [update],
  );
  return {
    ...state,
    revealEntry,
    deferNotification,
    clearNotificationTarget,
    setView,
    setSort,
    setQuery: (query: string) => update({ query }, "replace"),
    setStatus: (status: string) => update({ status }),
    setDiscount: (discount: DiscountFilter) => update({ discount }),
    setReview: (review: ReviewFilter) => update({ review }),
    setPlatform: (platform: string) => update({ platform }),
    setYear: (year: string) => update({ year }),
    setSuggestionHours: (suggestionHours: string) =>
      update({ suggestionHours }, "replace"),
    setSuggestionUnknownEstimates: (suggestionUnknownEstimates: boolean) =>
      update({ suggestionUnknownEstimates }),
    resetSuggestions: () =>
      update({
        platform: "",
        suggestionHours: "",
        estimateTarget: "story",
        suggestionUnknownEstimates: false,
      }),
    setCompareYear: (compareYear: string) => update({ compareYear }),
    setEstimateTarget: (estimateTarget: JournalLocation["estimateTarget"]) =>
      update({ estimateTarget }),
    setNotificationOpen: (notificationOpen: boolean) =>
      update({ notificationOpen }),
    setNotificationRead: (
      notificationRead: JournalLocation["notificationRead"],
    ) => update({ notificationRead }),
    setNotificationKind: (
      notificationKind: JournalLocation["notificationKind"],
    ) => update({ notificationKind }),
  };
}
