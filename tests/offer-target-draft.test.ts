import { expect, it } from "vitest";
import { offerTargetChanges } from "../src/lib/offers/target-draft";
const offers = [
  { id: "steam", target_price: 10 },
  { id: "nintendo", target_price: null },
];
it("includes only changed targets and preserves zero and cleared values", () => {
  expect(offerTargetChanges(offers, {})).toEqual({
    updates: [],
    invalidOfferId: null,
  });
  expect(offerTargetChanges(offers, { steam: "10.00" }).updates).toEqual([]);
  expect(
    offerTargetChanges(offers, { steam: "", nintendo: "0" }).updates,
  ).toEqual([
    { id: "steam", target_price: null },
    { id: "nintendo", target_price: 0 },
  ]);
  expect(offerTargetChanges(offers, { steam: " 8.25 " }).updates).toEqual([
    { id: "steam", target_price: 8.25 },
  ]);
});
it.each(["-1", "Infinity", "invalid"])(
  "rejects invalid target %s before saving any field",
  (value) => {
    expect(offerTargetChanges(offers, { steam: "8", nintendo: value })).toEqual(
      { updates: [], invalidOfferId: "nintendo" },
    );
  },
);
