import { useRef, type ComponentProps } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import type { ResourceState } from "@/lib/resource";
import { GlobalSearchDraftDecision } from "./global-search-draft-decision";
import { GlobalSearchResults } from "./global-search-results";

export function GlobalSearchDialog({
  open,
  query,
  working,
  online,
  state,
  decision,
  results,
  onQueryChange,
  onClose,
  onRestoreFocus,
  onRetry,
}: {
  open: boolean;
  query: string;
  working: boolean;
  online: boolean;
  state: Pick<ResourceState<unknown>, "status" | "error" | "checkedAt">;
  decision?: Omit<
    ComponentProps<typeof GlobalSearchDraftDecision>,
    "working" | "online"
  >;
  results: Omit<
    ComponentProps<typeof GlobalSearchResults>,
    "ready" | "hasQuery" | "resultsRef" | "onKeyDown"
  >;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onRestoreFocus: () => void;
  onRetry: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLDivElement>(null);
  const ready = state.checkedAt !== null;

  function buttons() {
    return Array.from(
      resultList.current?.querySelectorAll<HTMLButtonElement>(
        "[data-search-result]",
      ) ?? [],
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buscar en todos mis juegos"
      onEscapeKeyDown={(event) => {
        if (working) event.preventDefault();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRestoreFocus();
      }}
    >
      <div className="global-search-body">
        <label className="global-search-input">
          <Search size={19} aria-hidden="true" />
          <input
            ref={input}
            autoFocus
            type="search"
            aria-label="Buscar en todos mis juegos"
            placeholder="Nombre, consola o período…"
            maxLength={500}
            value={query}
            disabled={working}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                (event.key === "ArrowDown" || event.key === "Enter") &&
                !decision
              ) {
                const first = buttons()[0];
                if (first) {
                  event.preventDefault();
                  if (event.key === "Enter") first.click();
                  else first.focus();
                }
              }
            }}
          />
        </label>
        {!online && (
          <p className="global-search-notice" role="status">
            Sin conexión. Buscando en los últimos datos cargados.
          </p>
        )}
        {state.status === "loading" && (
          <p className="global-search-notice" role="status">
            <LoaderCircle size={14} className="save-spinner" />
            {ready ? "Actualizando juegos…" : "Cargando juegos…"}
          </p>
        )}
        {state.error && (
          <div className="global-search-notice error" role="alert">
            {ready
              ? "No se pudieron actualizar los juegos. Se conserva la última versión."
              : "No se pudieron cargar tus juegos."}{" "}
            <button className="text-button" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        )}
        {decision ? (
          <GlobalSearchDraftDecision
            {...decision}
            working={working}
            online={online}
          />
        ) : (
          <GlobalSearchResults
            {...results}
            ready={ready}
            hasQuery={!!query.trim()}
            resultsRef={resultList}
            onKeyDown={(event) => {
              const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
              if (!keys.includes(event.key)) return;
              const items = buttons();
              const index = items.indexOf(event.target as HTMLButtonElement);
              if (index < 0) return;
              event.preventDefault();
              if (event.key === "ArrowUp" && index === 0) {
                input.current?.focus();
                return;
              }
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : event.key === "ArrowDown"
                      ? Math.min(index + 1, items.length - 1)
                      : index - 1;
              items[next]?.focus();
            }}
          />
        )}
      </div>
    </Modal>
  );
}
