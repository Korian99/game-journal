"use client";
import type { JournalView } from "@/lib/journal/journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { releaseHasArrived, releaseLabel } from "@/lib/releases";
import { statuses, type Offer } from "@/lib/types";
import { wishlistPlatforms } from "@/lib/offers/wishlist-display";
import type { Table } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { JournalReview, JournalScoreMark } from "./journal-review";
import { QuickActions } from "../games/quick-actions";
import { HypeBadge } from "../games/hype-badge";
import { journalTextFields, libraryTextFields } from "./journal-columns";
import {
  LibraryFinishReason,
  LibraryPlaythrough,
  ReviewMark,
} from "./library-game-details";
import { OwnershipBadge } from "../games/ownership-badge";
import { PriorityMark } from "../games/priority-mark";
import { WishlistPrice } from "../offers/wishlist-price";

export function JournalGameTable({
  table,
  view,
  offers,
  releaseNow,
  onEdit,
  onQuickSave,
  disabled,
  entryRowClass,
}: {
  table: Table<JournalEntry>;
  view: JournalView;
  offers: Offer[];
  releaseNow: Date;
  onEdit: (entry: JournalEntry) => void;
  onQuickSave: (entry: JournalEntry) => Promise<boolean>;
  disabled: boolean;
  entryRowClass: (entry: JournalEntry) => string | undefined;
}) {
  return (
    <>
      <div className="mobile-games">
        {table.getRowModel().rows.map(({ original: r }) => (
          <article className="mobile-game-wrapper" key={r.id}>
            <button
              className={["mobile-game", entryRowClass(r)]
                .filter(Boolean)
                .join(" ")}
              key={r.id}
              onClick={() => onEdit(r)}
            >
              {view === "library" ? (
                <ReviewMark rating={r.rating} />
              ) : view === "journal" ? (
                <JournalScoreMark record={r} />
              ) : view === "wishlist" ? (
                <PriorityMark value={r.priority} />
              ) : (
                <span className="game-mark">
                  {r.title.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="mobile-game-info">
                <strong>{r.title}</strong>
                {view === "upcoming" ? (
                  <>
                    <small>
                      {wishlistPlatforms(
                        r,
                        offers.filter((o) => o.game_id === r.gameId),
                      ).join(" · ") || "Plataforma sin confirmar"}
                    </small>
                    <small>
                      Fecha de salida: {releaseLabel(r)}
                      {releaseHasArrived(r, releaseNow) && (
                        <span className="released-badge">Ya salió</span>
                      )}
                    </small>
                    <small className="upcoming-mobile-hype">
                      Hype <HypeBadge value={r.hype} />
                    </small>
                  </>
                ) : view === "wishlist" ? (
                  <>
                    <small>
                      {wishlistPlatforms(
                        r,
                        offers.filter((o) => o.game_id === r.gameId),
                      ).join(" · ") || "Plataforma sin confirmar"}
                    </small>
                    <small className="wishlist-mobile-meta">
                      <OwnershipBadge value={r.ownership} />
                    </small>
                    <small>Hs. estimadas: {r.estimated || "—"}</small>
                    <WishlistPrice
                      offers={offers.filter((o) => o.game_id === r.gameId)}
                    />
                  </>
                ) : (
                  <>
                    <small>
                      {r.device || r.platforms || "Plataforma sin definir"}
                      {view !== "library" && r.period ? " · " + r.period : ""}
                    </small>
                    <span className={"status " + r.status}>
                      {statuses[r.status]}
                    </span>
                    {view === "library" && <LibraryPlaythrough record={r} />}
                    {view === "journal" && <JournalReview record={r} />}
                    {(view === "library" || view === "journal") &&
                      (view === "library"
                        ? libraryTextFields
                        : journalTextFields
                      ).map(({ key, label }) =>
                        view === "library" && key === "reason" ? (
                          <small className="mobile-entry-detail" key={key}>
                            <LibraryFinishReason record={r} showLabel />
                          </small>
                        ) : r[key] ? (
                          <small className="mobile-entry-detail" key={key}>
                            <b>{label}</b>
                            <span>{r[key]}</span>
                          </small>
                        ) : null,
                      )}
                  </>
                )}
                {view !== "library" && (
                  <small className="mobile-game-hours">
                    Hs. jugadas: {r.hours == null ? "—" : r.hours + " h"}
                  </small>
                )}
              </span>
            </button>
            <QuickActions entry={r} disabled={disabled} onSave={onQuickSave} />
          </article>
        ))}
      </div>
      <div className="table-scroll">
        <table
          className={
            view === "upcoming"
              ? "upcoming-table"
              : view === "library"
                ? "library-table"
                : view === "journal"
                  ? "journal-table"
                  : view === "wishlist"
                    ? "wishlist-table"
                    : undefined
          }
        >
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th
                    key={h.id}
                    aria-sort={
                      h.column.getIsSorted() === "asc"
                        ? "ascending"
                        : h.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <button
                      disabled={!h.column.getCanSort()}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanSort() && <ArrowUpDown size={12} />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.original.id ?? r.id}
                className={entryRowClass(r.original)}
              >
                {r.getVisibleCells().map((c) => (
                  <td key={c.column.id}>
                    {c.column.id === "actions" ? (
                      <QuickActions
                        entry={r.original}
                        disabled={disabled}
                        onSave={onQuickSave}
                      />
                    ) : (
                      flexRender(c.column.columnDef.cell, c.getContext())
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
