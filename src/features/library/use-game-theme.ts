import { useEffect, useRef, useState } from "react";
import { effectiveCoverUrl } from "@/lib/covers";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { defaultGameThemeColor, sampleCoverColors } from "./game-theme-colors";

type GameTheme = { entryId: string; color: string };

function isGameThemeColor(color: unknown): color is string {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
}

function readGameTheme(raw: string | null): GameTheme | null {
  if (!raw) return null;
  // The old pinned cover wrote the entry ID on its own.
  if (!raw.startsWith("{")) return { entryId: raw, color: defaultGameThemeColor };
  const value = JSON.parse(raw) as Partial<GameTheme>;
  return typeof value.entryId === "string" && isGameThemeColor(value.color)
    ? { entryId: value.entryId, color: value.color }
    : null;
}

export function useGameTheme(memberId: string | undefined, records: JournalEntry[]) {
  const [stored, setStored] = useState<{ memberId: string; theme: GameTheme | null } | null>(null);
  const storageKey = memberId ? `journal-library-cover:${memberId}` : null;
  const sampling = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!memberId || !storageKey) return;
    let theme: GameTheme | null = null;
    try {
      theme = readGameTheme(window.localStorage.getItem(storageKey));
    } catch {
      // A malformed preference or unavailable storage has no active theme.
    }
    setStored({ memberId, theme });
    return () => sampling.current?.abort();
  }, [memberId, storageKey]);

  const saved = stored?.memberId === memberId ? stored?.theme : null;
  const entry = saved && records.find((record) => record.id === saved.entryId);

  function writeGameTheme(theme: GameTheme | null) {
    if (!memberId || !storageKey) return;
    setStored({ memberId, theme });
    try {
      if (theme) window.localStorage.setItem(storageKey, JSON.stringify(theme));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // The selected theme still applies in this tab.
    }
  }

  function setGameTheme(theme: GameTheme | null) {
    sampling.current?.abort();
    writeGameTheme(theme);
  }

  function selectGameTheme(entry: JournalEntry) {
    if (!memberId || !entry.id || entry.id === saved?.entryId) return;
    const choice = { entryId: entry.id, color: defaultGameThemeColor };
    setGameTheme(choice);
    const coverUrl = effectiveCoverUrl(entry.cover);
    if (!coverUrl) return;
    const request = new AbortController();
    sampling.current = request;
    const timeout = window.setTimeout(() => request.abort(), 2500);
    void sampleCoverColors(coverUrl, request.signal)
      .then(([color]) => {
        if (color && !request.signal.aborted) writeGameTheme({ ...choice, color });
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout);
        if (sampling.current === request) sampling.current = null;
      });
  }

  return { gameTheme: saved && entry ? { entry, color: saved.color } : null, setGameTheme, selectGameTheme };
}
