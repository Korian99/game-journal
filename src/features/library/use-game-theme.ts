import { useEffect, useRef } from "react";
import { effectiveCoverUrl } from "@/lib/covers";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { AppearanceGame } from "@/features/settings/appearance-contracts";
import { defaultGameThemeColor, sampleCoverColors } from "./game-theme-colors";

export function useGameTheme(
  memberId: string | undefined,
  records: JournalEntry[],
  saved: AppearanceGame | null,
  save: (game: AppearanceGame | null, expectedGame?: AppearanceGame) => Promise<boolean>,
) {
  const sampling = useRef<AbortController | null>(null);
  useEffect(() => () => sampling.current?.abort(), [memberId]);
  const entry = saved && records.find((record) => record.id === saved.entryId);

  function setGameTheme(game: AppearanceGame | null) {
    sampling.current?.abort();
    return save(game);
  }

  async function selectGameTheme(entry: JournalEntry) {
    if (!memberId || !entry.id || entry.id === saved?.entryId) return;
    const choice = { entryId: entry.id, color: defaultGameThemeColor };
    sampling.current?.abort();
    const request = new AbortController();
    sampling.current = request;
    if (!(await save(choice)) || request.signal.aborted) return;
    const coverUrl = effectiveCoverUrl(entry.cover);
    if (!coverUrl) return;
    const timeout = window.setTimeout(() => request.abort(), 2500);
    try {
      const [color] = await sampleCoverColors(coverUrl, request.signal);
      if (color && !request.signal.aborted) await save({ ...choice, color }, choice);
    } catch {
      // The default accent remains applied when cover pixels are unavailable.
    } finally {
      window.clearTimeout(timeout);
      if (sampling.current === request) sampling.current = null;
    }
  }

  return { gameTheme: saved && entry ? { entry, color: saved.color } : null, setGameTheme, selectGameTheme };
}
