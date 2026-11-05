import type { ReactNode } from "react";
import type { SharingData } from "@/lib/contracts";
import { statuses, type Status } from "@/lib/types";

type SharedGame = SharingData["shared"][number];

export function SharedGames({
  games,
  emptyState,
}: {
  games: SharedGame[];
  emptyState: ReactNode;
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
        emptyState
      )}
    </section>
  );
}
