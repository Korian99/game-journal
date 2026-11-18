import type { ComponentProps } from "react";
import { JournalCollectionPanel } from "@/features/journal/journal-collection-panel";
import { NotebookCollectionHeading } from "@/features/library/games/notebook-library-toolbar";

export function UpcomingScreenHeader({
  resultsCount,
  onAdd,
}: {
  resultsCount: number;
  onAdd: () => void;
}) {
  return (
    <div className="notebook-library-controls">
      <NotebookCollectionHeading
        title="Próximos"
        kicker={`${resultsCount} ${resultsCount === 1 ? "juego" : "juegos"}`}
        onAdd={onAdd}
      />
    </div>
  );
}

export function UpcomingScreen({
  collection,
}: {
  collection: Omit<ComponentProps<typeof JournalCollectionPanel>, "view">;
}) {
  return <JournalCollectionPanel {...collection} view="upcoming" />;
}
