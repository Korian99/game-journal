import type { ComponentProps, ReactNode } from "react";
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
}: {
  collection: Omit<ComponentProps<typeof JournalCollectionPanel>, "view">;
  detailEntryId: string;
  detail?: DetailProps;
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
        summaryContent={summaryContent}
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
