"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { GlobalSearchDialog } from "./global-search-dialog";
import { searchJournal } from "./search";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { ResourceState } from "@/lib/resource";
import type { Offer } from "@/lib/types";

export type SearchDecision = "save" | "discard";
export function GlobalSearch({
  records,
  offers,
  state,
  online,
  blocked,
  dirty,
  saveError,
  onChoose,
  onRetry,
}: {
  records: JournalEntry[];
  offers: Offer[];
  state: Pick<ResourceState<unknown>, "status" | "error" | "checkedAt">;
  online: boolean;
  blocked: boolean;
  dirty: boolean;
  saveError: string;
  onChoose: (
    entry: JournalEntry,
    decision?: SearchDecision,
  ) => Promise<boolean>;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const [pending, setPending] = useState<JournalEntry | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigating = useRef(false);
  const groups = useMemo(
    () => searchJournal(records, query, offers),
    [records, query, offers],
  );
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  let remaining = limit;
  const visible = groups.flatMap((group) => {
    const entries = group.entries.slice(0, Math.max(0, remaining));
    remaining -= entries.length;
    return entries.length ? [{ ...group, entries }] : [];
  });
  function show() {
    if (blocked) return;
    navigating.current = false;
    setQuery("");
    setLimit(30);
    setPending(null);
    setFailed(false);
    setOpen(true);
  }
  function close() {
    if (!working) {
      setOpen(false);
      setPending(null);
    }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "k"
      )
        return;
      if (
        document.querySelector('[role="dialog"]') ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      if (!blocked) {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function choose(entry: JournalEntry, decision?: SearchDecision) {
    if (working || blocked) return;
    if (dirty && !decision) {
      setPending(entry);
      setFailed(false);
      return;
    }
    setWorking(true);
    setFailed(false);
    try {
      if (await onChoose(entry, decision)) {
        navigating.current = true;
        setOpen(false);
        setPending(null);
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="global-search-trigger"
        aria-label="Buscar en todos mis juegos"
        title="Buscar en todos mis juegos (Ctrl+K)"
        disabled={blocked}
        onClick={show}
      >
        <Search size={17} />
        <span>Buscar en todos mis juegos</span>
        <kbd>Ctrl K</kbd>
      </button>
      <GlobalSearchDialog
        open={open}
        query={query}
        working={working}
        online={online}
        state={state}
        onClose={close}
        onRestoreFocus={() => {
          if (!navigating.current) trigger.current?.focus();
        }}
        onQueryChange={(value) => {
          setQuery(value);
          setLimit(30);
          setPending(null);
          setFailed(false);
        }}
        onRetry={onRetry}
        decision={
          pending
            ? {
                title: pending.title,
                failed,
                saveError,
                blocked,
                onSave: () => void choose(pending, "save"),
                onDiscard: () => void choose(pending, "discard"),
                onKeepEditing: close,
              }
            : undefined
        }
        results={{
          failed,
          groupCount: groups.length,
          total,
          visible,
          moreCount: total - limit,
          disabled: working || blocked,
          onChoose: (entry) => void choose(entry),
          onShowMore: () => setLimit((value) => value + 30),
        }}
      />
    </>
  );
}
