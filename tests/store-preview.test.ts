import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async () => {
  const { errorResponse } = await import("../src/lib/api-errors");
  return { authorized: auth, apiError: errorResponse };
});
import { POST } from "../src/app/api/store-preview/route";

const steam = "https://store.steampowered.com/app/620/Portal_2/?cc=US";
const nintendo = "https://www.nintendo.com/es-ar/store/products/test-switch/";
const fetchStore = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.restoreAllMocks();
  fetchStore.mockReset();
  vi.stubGlobal("fetch", fetchStore);
  auth.mockResolvedValue({ db: {} });
});
async function preview(url: string, includeUsPage = false) {
  return POST(
    new Request("http://fixture/api/store-preview", {
      method: "POST",
      body: JSON.stringify({
        url,
        ...(includeUsPage ? { includeUsPage } : {}),
      }),
    }),
  );
}
function nintendoProductHtml(url: string | undefined, title = "Verified game") {
  const product = { "@type": "Product", name: title, ...(url ? { url } : {}) };
  return (
    '<script type="application/ld+json">' +
    JSON.stringify(product) +
    "</script>"
  );
}
it("adds a verified US Nintendo counterpart when requested", async () => {
  const us = "https://www.nintendo.com/us/store/products/test-switch/";
  const html = (url: string, name: string) =>
    '<script type="application/ld+json">' +
    JSON.stringify({ "@type": "Product", name, url }) +
    "</script>";
  fetchStore.mockImplementation(
    async (input) =>
      new Response(
        html(
          String(input).includes("/us/") ? us : nintendo,
          "Verified Nintendo product",
        ),
      ),
  );
  const response = await preview(nintendo, true);
  expect(response.status).toBe(200);
  expect(fetchStore).toHaveBeenCalledTimes(2);
  expect(await response.json()).toMatchObject({
    url: nintendo,
    additionalPages: [us],
    fields: { title: "Verified Nintendo product" },
  });
});
it.each([
  ["a 404 page", async () => new Response("not found", { status: 404 })],
  [
    "a different product",
    async () =>
      new Response(nintendoProductHtml("/us/store/products/other-game/")),
  ],
  [
    "generic metadata without a product URL",
    async () => new Response(nintendoProductHtml(undefined)),
  ],
  [
    "a network failure",
    async () => {
      throw new Error("offline");
    },
  ],
])(
  "keeps the AR preview when the US counterpart has %s",
  async (_label, loadUs) => {
    const arHtml = nintendoProductHtml(nintendo, "Selected AR game");
    fetchStore.mockImplementation(async (input) =>
      String(input).includes("/us/") ? loadUs() : new Response(arHtml),
    );
    const response = await preview(nintendo, true);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      url: nintendo,
      fields: { title: "Selected AR game" },
    });
    expect(body).not.toHaveProperty("additionalPages");
  },
);

it("does not request a US page without opt-in or for Steam", async () => {
  fetchStore.mockResolvedValue(
    Response.json({
      "620": {
        success: true,
        data: { name: "Portal 2", platforms: { windows: true } },
      },
    }),
  );
  expect((await preview(steam)).status).toBe(200);
  expect(fetchStore).toHaveBeenCalledTimes(1);
});
it("keeps the AR preview when the optional US request times out", async () => {
  const arHtml = nintendoProductHtml(nintendo, "Selected AR game");
  fetchStore.mockImplementation((input, init) => {
    if (String(input).includes("/us/"))
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return reject(new Error("Missing request signal"));
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    return Promise.resolve(new Response(arHtml));
  });
  const response = await preview(nintendo, true);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    url: nintendo,
    fields: { title: "Selected AR game" },
  });
});
it("previews Steam fields and its regional price without writing to the database", async () => {
  fetchStore.mockResolvedValue(
    Response.json({
      "620": {
        success: true,
        data: {
          name: "Portal 2",
          header_image:
            "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
          platforms: { windows: true, mac: true, linux: true },
          release_date: { coming_soon: false, date: "18 Apr, 2011" },
          price_overview: {
            final: 999,
            initial: 1999,
            currency: "USD",
            discount_percent: 50,
          },
        },
      },
    }),
  );
  const response = await preview(steam);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toMatchObject({
    url: "https://store.steampowered.com/app/620/?cc=US",
    store: "steam",
    region: "US",
    cover: {
      providerUrl:
        "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
      provider: "steam",
    },
    fields: {
      title: "Portal 2",
      platforms: "PC",
      release: "2011-04-18",
      year: 2011,
    },
    quote: { price: 9.99, regular: 19.99, discount: 50, currency: "USD" },
  });
  const requestUrl = String(fetchStore.mock.calls[0][0]);
  expect(requestUrl).toContain("cc=us");
  expect(requestUrl).toContain("l=english");
});
it("does not turn vague Steam dates into invented exact dates", async () => {
  fetchStore.mockResolvedValue(
    Response.json({
      "620": {
        success: true,
        data: {
          name: "Future game",
          release_date: { coming_soon: true, date: "Q4 2027" },
        },
      },
    }),
  );
  const body = await (await preview(steam)).json();
  expect(body.fields).toEqual({ title: "Future game" });
  expect(body.quote.status).toBe("upcoming");
});
it("loads only the selected Nintendo product, including release, system and quote", async () => {
  const html =
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@graph": [
        {
          "@type": "Product",
          name: "Related game",
          url: "/es-ar/store/products/other-switch/",
          gamePlatform: "Nintendo Switch 2",
          datePublished: "2025-01-01",
        },
        {
          "@type": ["VideoGame", "Product"],
          name: "Selected game",
          offers: { url: nintendo, price: 1000, priceCurrency: "ARS" },
          gamePlatform: "Nintendo Switch",
          image: "https://assets.nintendo.com/image/upload/selected.jpg",
        },
      ],
    }) +
    "</script><h3>Fecha de lanzamiento</h3><div>12 de junio de 2018</div>";
  fetchStore.mockResolvedValue(new Response(html));
  expect(await (await preview(nintendo)).json()).toMatchObject({
    fields: {
      title: "Selected game",
      platforms: "Switch",
      release: "2018-06-12",
      year: 2018,
    },
    cover: {
      providerUrl: "https://assets.nintendo.com/image/upload/selected.jpg",
      provider: "nintendo",
    },
    quote: { price: 1000, currency: "ARS" },
  });
});
it("allows Nintendo metadata when the price is not available", async () => {
  fetchStore.mockResolvedValue(
    new Response(
      '<script type="application/ld+json">' +
        JSON.stringify({
          "@type": "VideoGame",
          url: nintendo,
          name: "Future Nintendo",
          gamePlatform: "Nintendo Switch 2",
          datePublished: "2027-03-05",
        }) +
        "</script>",
    ),
  );
  expect(await (await preview(nintendo)).json()).toMatchObject({
    fields: {
      title: "Future Nintendo",
      platforms: "Switch 2",
      release: "2027-03-05",
    },
    quote: { price: null },
  });
});
it("omits an unsupported upstream image without failing the preview", async () => {
  fetchStore.mockResolvedValue(
    Response.json({
      "620": {
        success: true,
        data: {
          name: "Portal 2",
          header_image: "https://images.example.org/untrusted.jpg",
        },
      },
    }),
  );
  const body = await (await preview(steam)).json();
  expect(body).toMatchObject({ fields: { title: "Portal 2" } });
  expect(body.cover).toBeUndefined();
});
it.each([
  "https://example.org/app/620/",
  "http://store.steampowered.com/app/620/",
  "https://store.steampowered.com.evil.test/app/620/",
])("rejects unsupported lookup URLs: %s", async (url) => {
  const response = await preview(url);
  expect(response.status).toBe(400);
  expect(fetchStore).not.toHaveBeenCalled();
});
it("rejects redirects outside the original store", async () => {
  fetchStore.mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "https://example.org/private" },
    }),
  );
  expect((await preview(steam)).status).toBe(503);
  expect(fetchStore).toHaveBeenCalledTimes(1);
});
it("reports temporary lookup failures without creating anything", async () => {
  fetchStore.mockRejectedValue(new Error("timeout"));
  const response = await preview(steam);
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe("TEMPORARY");
});
it("requires an active account before making a store request", async () => {
  auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await preview(steam)).status).toBe(401);
  expect(fetchStore).not.toHaveBeenCalled();
});
it("rejects missing products rather than returning an empty successful draft", async () => {
  fetchStore.mockResolvedValue(Response.json({ "620": { success: false } }));
  expect((await preview(steam)).status).toBe(503);
});

afterEach(() => vi.unstubAllGlobals());
it("rejects oversized decoded responses", async () => {
  fetchStore.mockResolvedValue(new Response("x".repeat(8_000_001)));
  expect((await preview(steam)).status).toBe(503);
});
it("rejects malformed upstream JSON", async () => {
  fetchStore.mockResolvedValue(new Response("not json"));
  expect((await preview(steam)).status).toBe(503);
});
