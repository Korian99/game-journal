"use client";
import { useMemo, useRef, useState } from "react";
import type { useJournalLocation } from "@/features/journal/use-journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { Offer } from "@/lib/types";
import { gameSuggestions } from "./suggestions";
import { SuggestionFilters } from "./suggestion-filters";
import { SuggestionResults } from "./suggestion-results";

type Props = {
  records: JournalEntry[];
  offers: Offer[];
  now: Date;
  location: ReturnType<typeof useJournalLocation>;
  ready: boolean;
  loadError: boolean;
  online: boolean;
  blocked: boolean;
  dirty: boolean;
  onRetry: () => void;
  onView: (entry: JournalEntry) => void;
  onStart: (entry: JournalEntry) => Promise<void>;
};

export function SuggestionsPanelHeader() {
  return (
    <div className="page-heading">
      <div>
        <h1>¿Qué juego ahora?</h1>
      </div>
    </div>
  );
}

export function SuggestionsPanel({
  records,
  offers,
  now,
  location,
  ready,
  loadError,
  online,
  blocked,
  dirty,
  onRetry,
  onView,
  onStart,
}: Props) {
  const {
    platform,
    suggestionHours,
    estimateTarget,
    suggestionUnknownEstimates,
  } = location;
  const result = useMemo(
    () =>
      gameSuggestions(
        records,
        offers,
        {
          platform,
          maxHours: suggestionHours === "" ? null : Number(suggestionHours),
          target: estimateTarget,
          includeUnknownEstimates: suggestionUnknownEstimates,
        },
        now,
      ),
    [
      records,
      offers,
      platform,
      suggestionHours,
      estimateTarget,
      suggestionUnknownEstimates,
      now,
    ],
  );
  const filterKey = JSON.stringify([
    platform,
    suggestionHours,
    estimateTarget,
    suggestionUnknownEstimates,
  ]);
  const [page, setPage] = useState({ key: filterKey, offset: 0 });
  const offset =
    page.key === filterKey
      ? Math.min(
          page.offset,
          Math.max(0, Math.ceil(result.items.length / 3) - 1) * 3,
        )
      : 0;
  const visible = result.items.slice(offset, offset + 3);
  const [savingId, setSavingId] = useState<string | null>(null);
  const saving = useRef(false);
  async function start(entry: JournalEntry) {
    if (saving.current || blocked || !online) return;
    saving.current = true;
    setSavingId(entry.id ?? null);
    try {
      await onStart(entry);
    } finally {
      saving.current = false;
      setSavingId(null);
    }
  }
  const availablePlatforms = Array.from(
    new Set([...result.platforms, ...(platform ? [platform] : [])]),
  );
  return (
    <section className="suggestions" aria-label="Sugerencias de juegos">
      <p className="muted suggestions-intro">
        Sin empezar o en pausa, con compra o acceso familiar.
      </p>
      <SuggestionFilters
        platform={platform}
        availablePlatforms={availablePlatforms}
        suggestionHours={suggestionHours}
        estimateTarget={estimateTarget}
        suggestionUnknownEstimates={suggestionUnknownEstimates}
        onPlatformChange={location.setPlatform}
        onHoursChange={(value) => {
          if (
            value === "" ||
            (Number.isFinite(Number(value)) &&
              Number(value) >= 0 &&
              Number(value) <= 100000)
          )
            location.setSuggestionHours(value);
        }}
        onTargetChange={location.setEstimateTarget}
        onIncludeUnknownChange={location.setSuggestionUnknownEstimates}
      />
      <SuggestionResults
        result={result}
        visible={visible}
        offset={offset}
        estimateTarget={estimateTarget}
        platform={platform}
        ready={ready}
        loadError={loadError}
        online={online}
        blocked={blocked}
        dirty={dirty}
        savingId={savingId}
        onRetry={onRetry}
        onView={onView}
        onStart={(entry) => void start(entry)}
        onReset={location.resetSuggestions}
        onPreviousPage={() =>
          setPage({ key: filterKey, offset: Math.max(0, offset - 3) })
        }
        onNextPage={() => setPage({ key: filterKey, offset: offset + 3 })}
      />
    </section>
  );
}
