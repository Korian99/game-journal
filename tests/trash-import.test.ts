import { expect, it } from "vitest";
import { emptyRecord } from "../src/lib/types";
import { makeImportPlan } from "../src/lib/domain";
it("requires restore before updating a source row that is in trash", () => {
  const old = {
    ...emptyRecord,
    id: "one",
    title: "Portal",
    sourceKey: "tab:portal",
    deleted_at: "2026-10-21T12:00:00Z",
  };
  const plan = makeImportPlan(
    [{ ...emptyRecord, title: "Portal", sourceKey: "tab:portal" }],
    [old],
  );
  expect(plan[0].kind).toBe("conflict");
  expect(plan[0].conflicts).toContain("trash");
});
