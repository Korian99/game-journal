import { expect, it } from "vitest";
import { parseSteam } from "../src/lib/domain";
it("does not crash on malformed optional Steam genres", () => {
  expect(() =>
    parseSteam({ success: true, data: { genres: "not an array" } }),
  ).not.toThrow();
});
