import type { ComponentProps } from "react";
import { JournalCollectionPanel } from "@/features/journal/journal-collection-panel";
import { NotebookCollectionHeading } from "../games/notebook-library-toolbar";

export function HistoryScreenHeader({
  selectedYear,
  resultsCount,
  onAdd,
}: {
  selectedYear: string;
  resultsCount: number;
  onAdd: () => void;
}) {
  return (
    <div className="notebook-library-controls">
      <NotebookCollectionHeading
        title="Histórico"
        kicker={`${selectedYear || "Todos los años"} · ${resultsCount} ${resultsCount === 1 ? "juego" : "juegos"}`}
        onAdd={onAdd}
      />
    </div>
  );
}

export function HistoryScreen({
  collection,
}: {
  collection: Omit<ComponentProps<typeof JournalCollectionPanel>, "view">;
}) {
  return <JournalCollectionPanel {...collection} view="journal" />;
}
