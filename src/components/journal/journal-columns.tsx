"use client";
import type { JournalView } from "@/lib/journal/journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";
import {
  compareReleases,
  releaseHasArrived,
  releaseLabel,
  releaseOrder,
} from "@/lib/releases";
import { statuses, type Offer, type Status } from "@/lib/types";
import {
  dateOrder,
  formatDate,
  periodOrder,
  reviewOrder,
  journalReviewOrder,
} from "@/lib/journal/view-config";
import { wishlistPlatforms } from "@/lib/offers/wishlist-display";
import type { SortingState } from "@tanstack/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { JournalReview, JournalScoreMark } from "./journal-review";
import { HypeBadge } from "../games/hype-badge";
import {
  LibraryFinishReason,
  LibraryPlaythrough,
  ReviewMark,
} from "./library-game-details";
import { OwnershipBadge, getOwnershipInfo } from "../games/ownership-badge";
import { PriorityMark } from "../games/priority-mark";
import { WishlistPrice } from "../offers/wishlist-price";

export const libraryTextFields = [
  { key: "reason", label: "Por qué" },
  { key: "impression", label: "Impresiones" },
  { key: "notes", label: "Comentarios adicionales" },
] as const;
export const journalTextFields = libraryTextFields.filter(
  ({ key }) => key === "notes",
);

export function useJournalColumns({
  view,
  offers,
  sort,
  releaseNow,
  onEdit,
}: {
  view: JournalView;
  offers: Offer[];
  sort: SortingState;
  releaseNow: Date;
  onEdit: (entry: JournalEntry) => void;
}) {
  return useMemo<ColumnDef<JournalEntry>[]>(() => {
    const withActions = (
      columns: ColumnDef<JournalEntry>[],
    ): ColumnDef<JournalEntry>[] => [
      ...columns,
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: () => null,
      },
    ];
    const commonColumns = {
      title: {
        accessorKey: "title",
        header: "Juego",
        cell: ({ row }) => (
          <button className="game-cell" onClick={() => onEdit(row.original)}>
            <span className="game-mark">
              {row.original.title.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{row.original.title}</strong>
              <small>
                {row.original.device ||
                  row.original.platforms ||
                  "Plataforma sin definir"}
              </small>
            </span>
          </button>
        ),
      },
      release: {
        id: "year",
        accessorFn: releaseOrder,
        header: "Lanzamiento",
        sortingFn: (a, b) =>
          compareReleases(
            a.original,
            b.original,
            sort.find((item) => item.id === "year")?.desc,
          ),
        sortUndefined: false,
        sortDescFirst: false,
        cell: ({ row }) => releaseLabel(row.original),
      },
      status: {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => (
          <span className={"status " + getValue()}>
            {statuses[getValue() as Status]}
          </span>
        ),
      },
      period: {
        id: "period",
        accessorFn: (record) => periodOrder(record.period),
        header: "Período",
        sortUndefined: "last",
        sortingFn: "basic",
        cell: ({ row }) => row.original.period || "—",
      },
      hours: {
        accessorKey: "hours",
        header: "Horas",
        cell: ({ getValue }) => (getValue() == null ? "—" : getValue() + " h"),
      },
      rating: {
        id: "rating",
        accessorFn: reviewOrder,
        header: "Reseña",
        sortingFn: "basic",
        sortUndefined: "last",
        sortDescFirst: true,
        cell: ({ row }) => (
          <span className="score">
            {row.original.rating != null
              ? row.original.rating + "/100"
              : row.original.memorability != null
                ? row.original.memorability + "/10"
                : "—"}
          </span>
        ),
      },
    } satisfies Record<string, ColumnDef<JournalEntry>>;
    if (view === "library")
      return withActions([
        {
          ...commonColumns.title,
          cell: ({ row }) => (
            <button
              className="game-cell library-game-cell"
              onClick={() => onEdit(row.original)}
            >
              <ReviewMark rating={row.original.rating} />
              <span className="library-game-identity">
                <strong>{row.original.title}</strong>
                <small>
                  {row.original.device ||
                    row.original.platforms ||
                    "Plataforma sin definir"}
                </small>
                <span className={"status " + row.original.status}>
                  {statuses[row.original.status]}
                </span>
              </span>
            </button>
          ),
        },
        {
          ...commonColumns.status,
          sortingFn: (a, b) =>
            statuses[a.original.status].localeCompare(
              statuses[b.original.status],
              "es",
            ),
        },
        {
          id: "started",
          accessorFn: (record) => dateOrder(record.started),
          header: "Partida",
          sortingFn: "basic",
          sortUndefined: "last",
          cell: ({ row }) => <LibraryPlaythrough record={row.original} />,
        },
        {
          id: "finished",
          accessorFn: (record) => dateOrder(record.finished),
          header: "Terminé",
          sortingFn: "basic",
          sortUndefined: "last",
          cell: ({ row }) => formatDate(row.original.finished) || "—",
        },
        {
          ...commonColumns.hours,
          id: "hours",
          accessorFn: (record) => record.hours ?? undefined,
          sortingFn: "basic",
          sortUndefined: "last",
        },
        {
          ...commonColumns.rating,
          accessorFn: (record) => record.rating ?? undefined,
        },
        ...libraryTextFields.map(({ key, label }): ColumnDef<JournalEntry> => ({
          accessorKey: key,
          header: label,
          cell: ({ getValue, row }) =>
            key === "reason" ? (
              <LibraryFinishReason record={row.original} />
            ) : (
              <span className="entry-text-cell">
                {getValue<string>() || "—"}
              </span>
            ),
        })),
      ]);
    if (view === "journal")
      return withActions([
        {
          ...commonColumns.title,
          cell: ({ row }) => (
            <button
              className="game-cell journal-game-cell"
              onClick={() => onEdit(row.original)}
            >
              <JournalScoreMark record={row.original} />
              <span className="library-game-identity">
                <strong>{row.original.title}</strong>
                <small>
                  {row.original.device ||
                    row.original.platforms ||
                    "Plataforma sin definir"}
                </small>
                <span className={"status " + row.original.status}>
                  {statuses[row.original.status]}
                </span>
              </span>
            </button>
          ),
        },
        commonColumns.release,
        commonColumns.period,
        {
          id: "rating",
          accessorFn: journalReviewOrder,
          header: "Valoración",
          sortingFn: "basic",
          sortUndefined: "last",
          sortDescFirst: true,
          cell: ({ row }) => <JournalReview record={row.original} />,
        },
        ...journalTextFields.map(({ key, label }): ColumnDef<JournalEntry> => ({
          accessorKey: key,
          header: label,
          cell: ({ getValue }) => (
            <span className="entry-text-cell">{getValue<string>() || "—"}</span>
          ),
        })),
      ]);
    const storeName: ColumnDef<JournalEntry> = {
      ...commonColumns.title,
      header: "Nombre",
      cell: ({ row }) => (
        <button
          className={
            "game-cell " +
            (view === "upcoming" ? "upcoming-name" : "wishlist-name")
          }
          onClick={() => onEdit(row.original)}
        >
          <span>
            <strong>{row.original.title}</strong>
            <small>
              {wishlistPlatforms(
                row.original,
                offers.filter((o) => o.game_id === row.original.gameId),
              ).join(" · ") || "Plataforma sin confirmar"}
            </small>
          </span>
        </button>
      ),
    };
    if (view === "upcoming")
      return withActions([
        {
          ...commonColumns.release,
          header: "Fecha de salida",
          cell: ({ row }) => (
            <span className="upcoming-release-date">
              <span>{releaseLabel(row.original)}</span>
              {releaseHasArrived(row.original, releaseNow) && (
                <span className="released-badge">Ya salió</span>
              )}
            </span>
          ),
        },
        storeName,
        {
          id: "hype",
          accessorFn: (record) => {
            const rank = ["Bajo", "Medio", "Dunno", "Alto", "Hyper"].indexOf(
              record.hype.trim(),
            );
            return rank < 0 ? undefined : rank;
          },
          header: "Hype",
          sortingFn: "basic",
          sortUndefined: "last",
          sortDescFirst: true,
          cell: ({ row }) => <HypeBadge value={row.original.hype} />,
        },
      ]);
    if (view !== "wishlist") return withActions(Object.values(commonColumns));
    return withActions([
      {
        id: "priority",
        accessorFn: (r) => r.priority ?? undefined,
        header: "Prioridad",
        sortUndefined: "last",
        sortDescFirst: false,
        sortingFn: (a, b) =>
          String(a.original.priority ?? "").localeCompare(
            String(b.original.priority ?? ""),
            "es",
            { numeric: true, sensitivity: "base" },
          ),
        cell: ({ row }) => <PriorityMark value={row.original.priority} />,
      },
      storeName,
      {
        id: "price",
        header: "Precio",
        enableSorting: false,
        cell: ({ row }) => (
          <WishlistPrice
            offers={offers.filter((o) => o.game_id === row.original.gameId)}
          />
        ),
      },
      {
        accessorKey: "ownership",
        header: "Acceso",
        sortingFn: (a, b) =>
          getOwnershipInfo(a.original.ownership).label.localeCompare(
            getOwnershipInfo(b.original.ownership).label,
            "es",
          ),
        cell: ({ getValue }) => (
          <OwnershipBadge value={getValue<string>() || ""} />
        ),
      },
      {
        accessorKey: "estimated",
        header: "Hs. Estimadas",
        cell: ({ getValue }) => getValue() || "—",
      },
    ]);
  }, [view, offers, sort, releaseNow, onEdit]);
}
