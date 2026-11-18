import { ExternalLink, Trash2 } from "lucide-react";
import type { EditorContext } from "./editor-context";

export function EntryPagesList({
  pages,
  busy,
  onRemovePage,
}: {
  pages: EditorContext["draft"]["pages"];
  busy: boolean;
  onRemovePage: (page: string) => void;
}) {
  return (
    <>
      {(pages ?? []).length > 0 && (
        <ul className="draft-pages" aria-label="Páginas del juego">
          {pages?.map((page) => (
            <li key={page}>
              <a href={page} target="_blank" rel="noopener noreferrer">
                {page}
                <ExternalLink size={13} />
              </a>
              <button
                type="button"
                className="icon-button danger"
                aria-label={"Quitar página " + page}
                disabled={busy}
                onClick={() => onRemovePage(page)}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
