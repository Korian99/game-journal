import type { ComponentProps } from "react";
import { JournalCollectionPanel } from "@/features/journal/journal-collection-panel";
import { NotebookCollectionHeading } from "@/features/library/games/notebook-library-toolbar";

export function WishlistScreenHeader({
  resultsCount,
  onAdd,
}: {
  resultsCount: number;
  onAdd: () => void;
}) {
  return (
    <div className="notebook-library-controls">
      <NotebookCollectionHeading
        title="Lista de deseos"
        kicker={`${resultsCount} ${resultsCount === 1 ? "juego" : "juegos"}`}
        onAdd={onAdd}
      />
    </div>
  );
}

export function WishlistScreen({
  collection,
}: {
  collection: Omit<ComponentProps<typeof JournalCollectionPanel>, "view">;
}) {
  return <JournalCollectionPanel {...collection} view="wishlist" />;
}
