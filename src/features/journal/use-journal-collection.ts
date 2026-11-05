"use client";
import { useMemo } from "react";
import type { JournalLocation } from "@/lib/journal/journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { WishlistAccessFilter } from "@/lib/journal/journal-location";
import { getOwnershipInfo } from "@/lib/journal/ownership";
import type { Offer } from "@/lib/types";
import {
  matchesViewYear,
  viewStatuses,
  viewYears,
} from "@/lib/journal/view-config";
import { summarizeGames } from "@/lib/journal/view-summary";
import {
  hasActiveDiscount,
  wishlistPlatforms,
} from "@/features/wishlist/wishlist-display";

const accessOwnership: Record<Exclude<WishlistAccessFilter, "">, string> = {
  owned: "Si",
  "not-owned": "No",
  family: "En familia",
};

type CollectionOptions = Pick<
  JournalLocation,
  "view" | "query" | "status" | "discount" | "access" | "review" | "platform" | "scale"
> & {
  records: JournalEntry[];
  offers: Offer[];
  selectedYear: string;
};

export function useJournalCollection({
  records,
  offers,
  view,
  query,
  status,
  discount,
  access,
  review,
  platform,
  scale,
  selectedYear,
}: CollectionOptions) {
  const yearOptions = useMemo(
    () =>
      [
        ...new Set([
          ...viewYears(
            records.filter((record) =>
              (viewStatuses[view] ?? []).includes(record.status),
            ),
            view,
          ),
          ...(selectedYear ? [selectedYear] : []),
        ]),
      ].sort((a, b) => Number(b) - Number(a)),
    [records, view, selectedYear],
  );
  const entriesInView = useMemo(
    () =>
      records.filter(
        (record) =>
          (viewStatuses[view] ?? []).includes(record.status) &&
          matchesViewYear(record, view, selectedYear),
      ),
    [records, view, selectedYear],
  );
  const games = useMemo(
    () =>
      entriesInView
        .filter(
          (r) =>
            !query ||
            [
              r.title,
              r.platforms,
              r.device,
              r.period,
              ...(["wishlist", "upcoming"].includes(view)
                ? wishlistPlatforms(
                    r,
                    offers.filter((o) => o.game_id === r.gameId),
                  )
                : []),
            ].some((v) =>
              String(v).toLowerCase().includes(query.toLowerCase()),
            ),
        )
        .filter((r) => !status || r.status === status)
        .filter((r) => !scale || r.scale === scale)
        .filter(
          (r) =>
            view !== "wishlist" ||
            !access ||
            getOwnershipInfo(r.ownership).value === accessOwnership[access],
        )
        .filter((r) => {
          if (view !== "journal" || !review) return true;
          return review === "with" ? r.rating != null : r.rating == null;
        })
        .filter((r) => {
          if (view !== "wishlist" || !discount) return true;
          const discounted = hasActiveDiscount(
            offers.filter((offer) => offer.game_id === r.gameId),
          );
          return discount === "discounted" ? discounted : !discounted;
        })
        .filter(
          (r) =>
            !platform ||
            (["wishlist", "upcoming"].includes(view)
              ? wishlistPlatforms(
                  r,
                  offers.filter((o) => o.game_id === r.gameId),
                )
              : (r.device + ";" + r.platforms).split(";").map((p) => p.trim())
            ).includes(platform),
        ),
    [
      entriesInView,
      query,
      status,
      discount,
      access,
      review,
      platform,
      scale,
      view,
      offers,
    ],
  );
  const summary = useMemo(
    () => summarizeGames(games, view === "library" ? selectedYear : ""),
    [games, view, selectedYear],
  );
  const platforms = [
    ...new Set(
      ["wishlist", "upcoming"].includes(view)
        ? records
            .filter((r) => (viewStatuses[view] ?? []).includes(r.status))
            .flatMap((r) =>
              wishlistPlatforms(
                r,
                offers.filter((o) => o.game_id === r.gameId),
              ),
            )
        : records.flatMap((r) =>
            (r.device + ";" + r.platforms)
              .split(";")
              .map((v) => v.trim())
              .filter(Boolean),
          ),
    ),
    ...(platform ? [platform] : []),
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();

  return { games, summary, platforms, yearOptions };
}
