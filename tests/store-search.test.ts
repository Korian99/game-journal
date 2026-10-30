import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => {
  const { errorResponse } = await import("../src/lib/api-errors");
  return { authorized: auth, apiError: errorResponse };
});
import { GET } from "../src/app/api/store-search/route";

const fetchStore = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.restoreAllMocks();
  fetchStore.mockReset();
  vi.stubGlobal("fetch", fetchStore);
  auth.mockResolvedValue({ db: {} });
});
afterEach(() => vi.unstubAllGlobals());

function search(term: string, store?: string) {
  const params = new URLSearchParams({ q: term });
  if (store !== undefined) params.set("store", store);
  return GET(new Request(`http://fixture/api/store-search?${params}`));
}
function row(
  id: string,
  title: string,
  href = `https://store.steampowered.com/app/${id}/`,
) {
  return `<a class="search_result_row" data-ds-appid="${id}" href="${href}"><span class="title">${title}</span></a>`;
}
function upstream(resultsHtml: string) {
  return Response.json({
    success: 1,
    total_count: 1,
    results_html: resultsHtml,
  });
}

it("requests the Steam game category and returns canonical app results", async () => {
  fetchStore.mockResolvedValue(upstream(row("620", "Portal 2")));
  const response = await search("  portal  ");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(String(fetchStore.mock.calls[0][0])).toBe(
    "https://store.steampowered.com/search/results/?term=portal&category1=998&count=10&start=0&infinite=1&l=spanish&cc=AR",
  );
  expect(fetchStore.mock.calls[0][1]).toMatchObject({
    redirect: "error",
    cache: "no-store",
  });
  expect(await response.json()).toEqual({
    results: [
      {
        store: "steam",
        title: "Portal 2",
        id: "620",
        url: "https://store.steampowered.com/app/620/",
      },
    ],
  });
});

it("skips package rows, mismatched IDs, external links, and invalid titles", async () => {
  fetchStore.mockResolvedValue(
    upstream(
      [
        row("620,99", "Bundle"),
        row("620", "Mismatched", "https://store.steampowered.com/app/999/"),
        row("88", "External", "https://example.org/app/88/"),
        `<a class="search_result_row" data-ds-appid="4" href="https://store.steampowered.com/app/4/"><span class="title">${"x".repeat(301)}</span></a>`,
        row("620", "Portal 2"),
      ].join(""),
    ),
  );
  expect(await (await search("portal")).json()).toMatchObject({
    results: [{ id: "620", title: "Portal 2" }],
  });
});

it("caps parsed game results at ten", async () => {
  fetchStore.mockResolvedValue(
    upstream(
      Array.from({ length: 12 }, (_, index) =>
        row(String(index + 1), `Game ${index}`),
      ).join(""),
    ),
  );
  const body = await (await search("games")).json();
  expect(body.results).toHaveLength(10);
  expect(body.results.at(-1)).toMatchObject({ id: "10", title: "Game 9" });
});

it("returns an empty list for a successful empty Steam response", async () => {
  fetchStore.mockResolvedValue(upstream(""));
  expect(await (await search("missing game")).json()).toEqual({ results: [] });
});

it.each(["", "a", "x".repeat(101)])(
  "rejects out of bounds query before fetch",
  async (term) => {
    expect((await search(term)).status).toBe(400);
    expect(fetchStore).not.toHaveBeenCalled();
  },
);

it("requires an active account before making a store request", async () => {
  auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await search("portal")).status).toBe(401);
  expect(fetchStore).not.toHaveBeenCalled();
});

it("rejects an unsupported store before making an upstream request", async () => {
  const response = await search("portal", "playstation");
  expect(response.status).toBe(400);
  expect(fetchStore).not.toHaveBeenCalled();
});

it.each([
  Response.json({ success: 0, results_html: "" }),
  Response.json({ success: 1, results_html: 4 }),
  new Response("not-json"),
  new Response("x".repeat(1_000_001)),
])(
  "rejects malformed or oversized Steam search responses",
  async (response) => {
    fetchStore.mockResolvedValue(response);
    expect((await search("portal")).status).toBe(503);
  },
);

it("reports Steam lookup failures without exposing upstream details", async () => {
  fetchStore.mockRejectedValue(new Error("upstream failure"));
  const response = await search("portal");
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("No se pudieron buscar");
});

it("searches the Nintendo Argentina game catalog and filters non-title products", async () => {
  fetchStore.mockResolvedValue(
    Response.json({
      hits: [
        {
          title: "The Legend of Zelda: Breath of the Wild",
          url: "/es-ar/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
          urlKey: "the-legend-of-zelda-breath-of-the-wild-switch",
          platform: "Nintendo Switch",
          topLevelCategoryCode: "GAMES",
          isUpgrade: false,
          visibleInSearch: true,
          eshopDetails: { productType: "TITLE" },
        },
        {
          title: "Breath of the Wild Expansion Pass",
          url: "/es-ar/store/products/breath-of-the-wild-expansion-pass/",
          urlKey: "breath-of-the-wild-expansion-pass",
          topLevelCategoryCode: "GAMES",
          isUpgrade: false,
          visibleInSearch: true,
          eshopDetails: { productType: "BUNDLE" },
        },
        {
          title: "Breath of the Wild Upgrade Pack",
          url: "/es-ar/store/products/breath-of-the-wild-upgrade/",
          urlKey: "breath-of-the-wild-upgrade",
          topLevelCategoryCode: "GAMES",
          isUpgrade: true,
          visibleInSearch: true,
          eshopDetails: { productType: "TITLE" },
        },
        {
          title: "Breath of the Wild Soundtrack",
          url: "/es-ar/store/products/breath-of-the-wild-soundtrack/",
          urlKey: "breath-of-the-wild-soundtrack",
          topLevelCategoryCode: "ADD_ON_CONTENT",
          isUpgrade: false,
          visibleInSearch: true,
          eshopDetails: { productType: "TITLE" },
        },
      ],
    }),
  );
  const response = await search("zelda", "nintendo");
  expect(response.status).toBe(200);
  expect(String(fetchStore.mock.calls[0][0])).toBe(
    "https://u3b6gr4ua3-dsn.algolia.net/1/indexes/store_game_es_ar/query",
  );
  const [url, init] = fetchStore.mock.calls[0];
  expect(new URL(String(url)).hostname).toBe("u3b6gr4ua3-dsn.algolia.net");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("x-algolia-application-id")).toBe(
    "U3B6GR4UA3",
  );
  expect(new Headers(init?.headers).get("x-algolia-api-key")).toBeTruthy();
  expect(JSON.parse(String(init?.body))).toMatchObject({
    query: "zelda",
    hitsPerPage: 30,
    analytics: false,
    clickAnalytics: false,
  });
  expect(await response.json()).toEqual({
    results: [
      {
        store: "nintendo",
        title: "The Legend of Zelda: Breath of the Wild",
        id: "the-legend-of-zelda-breath-of-the-wild-switch",
        url: "https://www.nintendo.com/es-ar/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
        platform: "Switch",
      },
    ],
  });
});
