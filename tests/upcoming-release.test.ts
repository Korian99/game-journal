import { expect, it } from "vitest";
import { upcomingReleaseUpdate } from "../src/features/stores/upcoming-release";

it("accepts valid provider releases only for an Upcoming entry in the Upcoming view", () => {
  expect(upcomingReleaseUpdate("upcoming", "upcoming", "2028-05-04")).toEqual({
    release: "2028-05-04",
    year: 2028,
  });
  expect(upcomingReleaseUpdate("library", "upcoming", "2028-05-04")).toBeNull();
  expect(upcomingReleaseUpdate("upcoming", "wishlist", "2028-05-04")).toBeNull();
  expect(upcomingReleaseUpdate("upcoming", "upcoming", "TBA")).toBeNull();
  expect(upcomingReleaseUpdate("upcoming", "upcoming", undefined)).toBeNull();
});
