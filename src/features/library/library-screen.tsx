import type { ComponentProps, ReactNode } from "react";
import { Gamepad2, SlidersHorizontal } from "lucide-react";
import { EntryEditor } from "@/features/entries/entry-editor";
import { JournalCollectionPanel } from "@/features/journal/journal-collection-panel";

export { NotebookLibraryToolbar as LibraryScreenHeader } from "./games/notebook-library-toolbar";

type DetailProps = Omit<
  ComponentProps<typeof EntryEditor>,
  "view" | "embedded" | "summaryContent" | "onReleaseFound"
> & { revision: number };

export function LibraryScreen({
  collection,
  detailEntryId,
  detail,
  nowPlaying,
  onSetNowPlaying,
  onPersonalizeNowPlaying,
}: {
  collection: Omit<ComponentProps<typeof JournalCollectionPanel>, "view">;
  detailEntryId: string;
  detail?: DetailProps;
  nowPlaying?: boolean;
  onSetNowPlaying?: () => void;
  onPersonalizeNowPlaying?: (trigger: HTMLButtonElement) => void;
}) {
  function renderDetail(summaryContent: ReactNode) {
    if (!detail) return summaryContent;
    const { revision, ...editorProps } = detail;
    return (
      <EntryEditor
        {...editorProps}
        key={`${editorProps.entry.id}-${revision}`}
        view="library"
        embedded
        summaryContent={
          <>
            {onSetNowPlaying && (
              <div className="library-use-theme">
                <button
                  type="button"
                  aria-pressed={nowPlaying}
                  onClick={onSetNowPlaying}
                >
                  <Gamepad2 size={17} aria-hidden="true" />
                  Mostrar como «Jugando ahora»
                </button>
                {onPersonalizeNowPlaying && (
                  <button
                    type="button"
                    className="library-personalize-now-playing"
                    aria-haspopup="dialog"
                    onClick={(event) => onPersonalizeNowPlaying(event.currentTarget)}
                  >
                    <SlidersHorizontal size={17} aria-hidden="true" />
                    Personalizar Jugando ahora
                  </button>
                )}
              </div>
            )}
            {summaryContent}
          </>
        }
        onReleaseFound={async () => null}
      />
    );
  }

  return (
    <JournalCollectionPanel
      {...collection}
      view="library"
      tableProps={{
        ...collection.tableProps,
        detailEntryId,
        detailEntry: detail?.entry,
        detailEditor: renderDetail,
      }}
    />
  );
}
