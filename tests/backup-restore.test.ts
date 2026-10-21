import { expect, it } from "vitest";
import { backupFixture } from "./fixtures/backup";
import { restoreSql } from "../src/lib/backups/restore";
const target = "78787878-7878-4878-8878-787878787878";
it("requires an empty target and remaps ownership without recreating sharing or credentials", () => {
  const fixture = backupFixture();
  const result = restoreSql(fixture, target);
  expect(result.sql).toContain("El proyecto de destino no está vacío");
  expect(result.sql).toContain(target);
  expect(result.sql).not.toMatch(/insert into (vault|auth)\./i);
  expect(result.sql).not.toMatch(/insert into public.shared_entries/i);
  expect(result.sql).not.toMatch(/delete from|truncate/i);
  expect(result.summary.playthroughs).toBe(1);
});
it("escapes review text as data instead of SQL", () => {
  const fixture = backupFixture();
  fixture.sourceTables.playthroughs[0].data.notes =
    "'; DROP TABLE public.games; --";
  const result = restoreSql(fixture, target);
  expect(result.sql).toContain("''; DROP TABLE public.games; --");
  expect(result.sql).toContain("::jsonb");
});
