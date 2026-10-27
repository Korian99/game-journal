import {
  findingKinds,
  type FindingKind,
  type FindingCategory,
} from "./data-checks";
import { normalizeConsoleLabels } from "./console-labels";
import type { SortingState } from "@tanstack/react-table";
import { currentYear, defaultViewSort, viewStatuses } from "./view-config";

export const journalViews = [
  "library",
  "journal",
  "wishlist",
  "upcoming",
  "shared",
  "settings",
  "statistics",
  "suggestions",
] as const;
export type JournalView = (typeof journalViews)[number];
export type DiscountFilter = "" | "discounted" | "not-discounted";
export type ReviewFilter = "" | "with" | "without";
export type JournalLocation = {
  view: JournalView;
  query: string;
  status: string;
  discount: DiscountFilter;
  review: ReviewFilter;
  platform: string;
  year: string;
  sort: SortingState;
  suggestionHours: string;
  suggestionUnknownEstimates: boolean;
  checkCategory: FindingCategory | "";
  checkKind: FindingKind | "";
  checkHidden: boolean;
  compareYear: string;
  estimateTarget: "story" | "extras" | "completionist";
  focusedEntry: string;
  notificationId: string;
  notificationOpen: boolean;
  notificationRead: "all" | "unread";
  notificationKind: "" | "discount" | "target" | "release" | "test";
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
  journal: ["title", "year", "period", "rating", "notes"],
  wishlist: ["priority", "title", "ownership", "estimated"],
  upcoming: ["year", "title", "hype"],
  shared: [],
  settings: [],
  statistics: [],
  suggestions: [],
};
const locationKeys = [
  "tab",
  "q",
  "status",
  "discount",
  "review",
  "platform",
  "year",
  "sort",
  "compareYear",
  "estimateTarget",
  "maxHours",
  "unknownEstimates",
  "checkCategory",
  "checkKind",
  "checkHidden",
  "notifications",
  "notificationRead",
  "notificationType",
  "entry",
  "notification",
];
export function defaultJournalLocation(
  view: JournalView = "library",
  present = currentYear(),
): JournalLocation {
  return {
    view,
    query: "",
    status: "",
    discount: "",
    review: "",
    platform: "",
    year: ["library", "statistics"].includes(view)
      ? present
      : view === "journal"
        ? "2024"
        : "",
    sort: columns[view].length ? defaultViewSort(view) : [],
    compareYear: view === "statistics" ? String(Number(present) - 1) : "",
    estimateTarget: "story",
    checkCategory: "",
    checkKind: "",
    checkHidden: false,
    suggestionHours: "",
    suggestionUnknownEstimates: false,
    focusedEntry: "",
    notificationId: "",
    notificationOpen: false,
    notificationRead: "unread",
    notificationKind: "",
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
  const targetId = (key: string) => {
    const value = params.get(key) ?? "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : "";
  };
  state.focusedEntry = targetId("entry");
  state.notificationId = targetId("notification");
  state.notificationOpen = params.get("notifications") === "open";
  state.notificationRead =
    params.get("notificationRead") === "all" ? "all" : "unread";
  const kind = params.get("notificationType");
  if (["discount", "target", "release", "test"].includes(kind ?? ""))
    state.notificationKind = kind as JournalLocation["notificationKind"];
  if (view === "statistics") {
    const year = params.get("year"),
      compare = params.get("compareYear"),
      target = params.get("estimateTarget");
    if (year && /^(19|20|21)\d{2}$/.test(year)) state.year = year;
    if (compare === "none") state.compareYear = "";
    else if (compare && /^(19|20|21)\d{2}$/.test(compare))
      state.compareYear = compare;
    if (target === "story" || target === "extras" || target === "completionist")
      state.estimateTarget = target;
    state.platform = normalizeConsoleLabels(
      bounded(params.get("platform"), 200),
    );
  }
  if (view === "suggestions") {
    state.platform = normalizeConsoleLabels(
      bounded(params.get("platform"), 200),
    );
    const hours = params.get("maxHours"),
      target = params.get("estimateTarget");
    if (hours && /^\d+(?:\.\d+)?$/.test(hours) && Number(hours) <= 100000)
      state.suggestionHours = String(Number(hours));
    if (target === "story" || target === "extras" || target === "completionist")
      state.estimateTarget = target;
    state.suggestionUnknownEstimates =
      params.get("unknownEstimates") === "include";
  }
  if (view === "settings") {
    const category = params.get("checkCategory"),
      kind = params.get("checkKind");
    if (
      category === "inconsistency" ||
      category === "suggestion" ||
      category === "reminder"
    )
      state.checkCategory = category;
    if (findingKinds.includes(kind as FindingKind))
      state.checkKind = kind as FindingKind;
    state.checkHidden = params.get("checkHidden") === "show";
  }
  if (!columns[view].length) return state;
  state.query = bounded(params.get("q"), 500);
  state.platform = normalizeConsoleLabels(bounded(params.get("platform"), 200));
  const status = params.get("status");
  if (
    ["library", "journal"].includes(view) &&
    viewStatuses[view]?.some((value) => value === status)
  )
    state.status = status!;
  const discount = params.get("discount");
  if (
    view === "wishlist" &&
    (discount === "discounted" || discount === "not-discounted")
  )
    state.discount = discount;
  const review = params.get("review");
  if (view === "journal" && (review === "with" || review === "without"))
    state.review = review;
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
      const legacy =
        view === "journal"
          ? item.replace(/^(memorability|impression)\./, "rating.")
          : item;
      const match = /^([a-z]+)\.(asc|desc)$/.exec(legacy);
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
  if (state.focusedEntry) params.set("entry", state.focusedEntry);
  if (state.notificationId) params.set("notification", state.notificationId);
  if (state.notificationOpen) params.set("notifications", "open");
  if (state.notificationRead === "all") params.set("notificationRead", "all");
  if (state.notificationKind)
    params.set("notificationType", state.notificationKind);
  if (state.view === "statistics") {
    params.set("year", state.year);
    params.set("compareYear", state.compareYear || "none");
    params.set("estimateTarget", state.estimateTarget);
    if (state.platform) params.set("platform", state.platform);
  }
  if (state.view === "suggestions") {
    if (state.platform) params.set("platform", state.platform);
    if (state.suggestionHours !== "")
      params.set("maxHours", state.suggestionHours);
    params.set("estimateTarget", state.estimateTarget);
    if (state.suggestionUnknownEstimates)
      params.set("unknownEstimates", "include");
  }
  if (state.view === "settings") {
    if (state.checkCategory) params.set("checkCategory", state.checkCategory);
    if (state.checkKind) params.set("checkKind", state.checkKind);
    if (state.checkHidden) params.set("checkHidden", "show");
  }
  if (columns[state.view].length) {
    if (state.query) params.set("q", state.query);
    if (state.status && ["library", "journal"].includes(state.view))
      params.set("status", state.status);
    if (state.discount && state.view === "wishlist")
      params.set("discount", state.discount);
    if (state.review && state.view === "journal")
      params.set("review", state.review);
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
