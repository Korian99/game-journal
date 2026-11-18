import { CollectionEmptyState } from "@/features/journal/journal-collection-panel";
import type { SharingData } from "@/lib/contracts";
import { statuses, type Status } from "@/lib/types";

type SharedGame = SharingData["shared"][number];

export function SharedGamesHeader() {
  return (
    <div className="page-heading">
      <div>
        <h1>
          Compartido conmigo<span className="accent">.</span>
        </h1>
      </div>
    </div>
  );
}

export function SharedGames({
  games,
  sharingError,
}: {
  games: SharedGame[];
  sharingError: boolean;
}) {
  return (
    <section className="panel">
      {games.length ? (
        games.map((r) => (
          <article className="shared-entry" key={r.shareId}>
            <span className="eyebrow">
              {r.owner} · {r.period}
            </span>
            <h2>{r.title}</h2>
            <p>
              {r.device} · {statuses[r.status as Status] ?? r.status} ·{" "}
              {r.hours ?? "—"} h
            </p>
            <p>
              Reseña: {r.rating ?? "—"} · Memorabilidad: {r.memorability ?? "—"} · Impresiones: {r.impression || "—"}
            </p>
          </article>
        ))
      ) : (
        <CollectionEmptyState
          title={
            sharingError
              ? "No se pudieron cargar los compartidos"
              : "Sin juegos compartidos"
          }
        />
      )}
    </section>
  );
}
