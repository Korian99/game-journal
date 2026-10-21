import { expect, it } from "vitest";
import * as location from "../src/lib/journal/journal-location";

it("restores a bookmarked tab, year, search, filters, and sort", () => {
  const state = location.readJournalLocation(
    "?tab=library&year=2025&q=Pok%C3%A9mon&status=completed&platform=Nintendo+DS&sort=rating.desc,title.asc",
    "2026",
  );
  expect(state).toEqual({
    compareYear: "",
    estimateTarget: "story",
    notificationOpen: false,
    notificationRead: "unread",
    notificationKind: "",
    view: "library",
    year: "2025",
    query: "Pokémon",
    status: "completed",
    discount: "",
    platform: "Nintendo DS",
    sort: [
      { id: "rating", desc: true },
      { id: "title", desc: false },
    ],
  });
});
it("keeps Diario at 2024 and Biblioteca at the current year by default", () => {
  expect(location.readJournalLocation("", "2027").year).toBe("2027");
  expect(location.readJournalLocation("?tab=journal", "2027").year).toBe(
    "2024",
  );
  expect(location.readJournalLocation("?tab=upcoming", "2027")).toMatchObject({
    view: "upcoming",
    year: "",
    sort: [
      { id: "year", desc: false },
      { id: "title", desc: false },
    ],
  });
});
it("round trips all years, no sorting, and Unicode platform names", () => {
  const state = location.readJournalLocation(
    "?tab=journal&year=all&platform=Consola+de+Jos%C3%A9&sort=none",
    "2026",
  );
  expect(state.year).toBe("");
  expect(state.sort).toEqual([]);
  const encoded = location.writeJournalLocation(
    state,
    "utm_source=bookmark&tab=library&status=playing",
    "2026",
  );
  expect(new URLSearchParams(encoded).get("utm_source")).toBe("bookmark");
  expect(new URLSearchParams(encoded).has("status")).toBe(false);
  expect(location.readJournalLocation(encoded, "2026")).toEqual(state);
});
it("rejects unknown tabs and sorts, invalid years, and mismatched status filters", () => {
  expect(
    location.readJournalLocation(
      "?tab=invalid&year=hello&status=remembered&sort=price.desc",
      "2026",
    ),
  ).toEqual(location.readJournalLocation("", "2026"));
  expect(
    location.readJournalLocation(
      "?tab=journal&status=wishlist&year=99999&sort=started.desc",
      "2026",
    ),
  ).toEqual(location.readJournalLocation("?tab=journal", "2026"));
  expect(
    location.readJournalLocation(
      "?tab=upcoming&year=2024&status=upcoming",
      "2026",
    ),
  ).toEqual(location.readJournalLocation("?tab=upcoming", "2026"));
  expect(
    location.readJournalLocation(
      "?tab=library&sort=rating.asc,rating.desc",
      "2026",
    ).sort,
  ).toEqual(location.readJournalLocation("", "2026").sort);
});
it("writes compact URLs, omits default filters, and clears inactive-view parameters", () => {
  const defaults = location.readJournalLocation("?tab=journal", "2026");
  expect(location.writeJournalLocation(defaults, "", "2026")).toBe(
    "tab=journal",
  );
  const settings = location.readJournalLocation(
    "?tab=settings&q=old&year=2025&status=playing&platform=PC&sort=rating.desc",
    "2026",
  );
  expect(
    location.writeJournalLocation(
      settings,
      "tab=library&q=old&year=2025&status=playing&platform=PC&sort=rating.desc",
      "2026",
    ),
  ).toBe("tab=settings");
});

it("keeps a bookmarked view through sign-in using a local return path", () => {
  expect(
    location.resolveJournalReturnPath("/?tab=wishlist&platform=PC", "2026"),
  ).toBe("/?tab=wishlist&platform=PC");
  expect(
    location.resolveJournalReturnPath(
      "/?tab=journal&year=all&sort=none",
      "2026",
    ),
  ).toBe("/?tab=journal&year=all&sort=none");
});
it("does not accept external or non-journal sign-in destinations", () => {
  for (const target of [
    null,
    "https://example.com/",
    "//example.com/",
    "javascript:alert(1)",
    "/login",
    "/api/records",
  ])
    expect(location.resolveJournalReturnPath(target, "2026")).toBe("/");
});

it.each(["discounted", "not-discounted"])(
  "restores and round trips the wishlist discount filter %s",
  (discount) => {
    const state = location.readJournalLocation(
      "?tab=wishlist&discount=" + discount,
      "2026",
    );
    expect(state).toMatchObject({ view: "wishlist", discount, status: "" });
    expect(
      location.readJournalLocation(
        location.writeJournalLocation(state, "", "2026"),
        "2026",
      ),
    ).toEqual(state);
  },
);
it("replaces the old wishlist status filter rather than retaining it", () => {
  const state = location.readJournalLocation(
    "?tab=wishlist&status=wishlist&discount=discounted",
    "2026",
  );
  expect(state.status).toBe("");
  const params = new URLSearchParams(
    location.writeJournalLocation(state, "status=wishlist", "2026"),
  );
  expect(params.has("status")).toBe(false);
  expect(params.get("discount")).toBe("discounted");
});
it.each(["library", "journal", "upcoming", "settings"])(
  "does not apply wishlist discounts to %s",
  (view) => {
    const state = location.readJournalLocation(
      "?tab=" + view + "&discount=discounted",
      "2026",
    );
    expect(state).toHaveProperty("discount", "");
    expect(
      new URLSearchParams(
        location.writeJournalLocation(state, "discount=discounted", "2026"),
      ).has("discount"),
    ).toBe(false);
  },
);
it("ignores invalid discount filters and omits the default from the URL", () => {
  const state = location.readJournalLocation(
    "?tab=wishlist&discount=invalid",
    "2026",
  );
  expect(state).toHaveProperty("discount", "");
  expect(location.writeJournalLocation(state, "discount=invalid", "2026")).toBe(
    "tab=wishlist",
  );
});

it("persists statistics and notification drawer controls", () => {
  const query =
    "tab=statistics&year=2025&compareYear=2024&estimateTarget=extras&notifications=open&notificationRead=all&notificationType=target";
  const state = location.readJournalLocation(query, "2026");
  expect(state.compareYear).toBe("2024");
  expect(state.estimateTarget).toBe("extras");
  expect(state.notificationOpen).toBe(true);
  expect(
    location.readJournalLocation(location.writeJournalLocation(state), "2026"),
  ).toEqual(state);
});
