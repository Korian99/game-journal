import type { SortingState } from "@tanstack/react-table";
import { currentYear, defaultViewSort, viewStatuses } from "./view-config";

export const journalViews = [
  "library",
  "journal",
  "wishlist",
  "upcoming",
  "shared",
  "settings",
] as const;
export type JournalView = (typeof journalViews)[number];
export type JournalLocation = {
  view: JournalView;
  query: string;
  status: string;
  platform: string;
  year: string;
  sort: SortingState;
};
const columns: Record<JournalView, string[]> = {
  library: [
    "title",
    "status",
    "started",
    "finished",
    "hours",
    "rating",
    "reason",
    "impression",
    "notes",
  ],
  journal: ["title", "year", "period", "memorability", "impression", "notes"],
  wishlist: ["priority", "title", "ownership", "estimated"],
  upcoming: ["year", "title", "hype"],
  shared: [],
  settings: [],
};
const locationKeys = ["tab", "q", "status", "platform", "year", "sort"];
export function defaultJournalLocation(
  view: JournalView = "library",
  present = currentYear(),
): JournalLocation {
  return {
    view,
    query: "",
    status: "",
    platform: "",
    year: view === "library" ? present : view === "journal" ? "2024" : "",
    sort: columns[view].length ? defaultViewSort(view) : [],
  };
}
function bounded(value: string | null, length: number): string {
  return value && value.length <= length ? value : "";
}
export function readJournalLocation(
  search: string | URLSearchParams,
  present = currentYear(),
): JournalLocation {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const view: JournalView = journalViews.includes(tab as JournalView)
    ? (tab as JournalView)
    : "library";
  const state = defaultJournalLocation(view, present);
  if (!columns[view].length) return state;
  state.query = bounded(params.get("q"), 500);
  state.platform = bounded(params.get("platform"), 200);
  const status = params.get("status");
  if (
    !["journal", "upcoming"].includes(view) &&
    viewStatuses[view]?.some((value) => value === status)
  )
    state.status = status!;
  if (["library", "journal"].includes(view)) {
    const year = params.get("year");
    if (year === "all") state.year = "";
    else if (
      year &&
      /^\d{4}$/.test(year) &&
      Number(year) >= 1900 &&
      Number(year) <= 2200
    )
      state.year = year;
  }
  const sort = params.get("sort");
  if (sort === "none") state.sort = [];
  else if (sort && sort.length <= 500) {
    const parsed: SortingState = [];
    for (const item of sort.split(",")) {
      const match = /^([a-z]+)\.(asc|desc)$/.exec(item);
      if (
        !match ||
        !columns[view].includes(match[1]) ||
        parsed.some((value) => value.id === match[1])
      )
        return state;
      parsed.push({ id: match[1], desc: match[2] === "desc" });
    }
    state.sort = parsed;
  }
  return state;
}
export function writeJournalLocation(
  state: JournalLocation,
  search: string | URLSearchParams = "",
  present = currentYear(),
): string {
  const params = new URLSearchParams(search);
  for (const key of locationKeys) params.delete(key);
  params.set("tab", state.view);
  if (columns[state.view].length) {
    if (state.query) params.set("q", state.query);
    if (state.status && !["journal", "upcoming"].includes(state.view))
      params.set("status", state.status);
    if (state.platform) params.set("platform", state.platform);
    const defaults = defaultJournalLocation(state.view, present);
    if (
      ["library", "journal"].includes(state.view) &&
      state.year !== defaults.year
    )
      params.set("year", state.year || "all");
    if (JSON.stringify(state.sort) !== JSON.stringify(defaults.sort))
      params.set(
        "sort",
        state.sort.length
          ? state.sort
              .map((item) => item.id + "." + (item.desc ? "desc" : "asc"))
              .join(",")
          : "none",
      );
  }
  return params.toString();
}

export function resolveJournalReturnPath(
  target: string | null,
  present = currentYear(),
): string {
  if (!target?.startsWith("/?")) return "/";
  const query = target.slice(2).split("#")[0];
  return (
    "/?" +
    writeJournalLocation(readJournalLocation(query, present), "", present)
  );
}
