import { expect, it } from "vitest";
import { backupFixture } from "./fixtures/backup";
import { restoreSql } from "../src/lib/backups/restore";
import { parseBackupSnapshot } from "../src/lib/backups/bundle";
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

it("preserves game cover metadata through old-format backup parsing and restore", () => {
  const fixture = backupFixture();
  const url =
    "https://assets.nintendo.com/image/upload/the-legend-of-zelda.jpg";
  fixture.records[0].cover = { provider: "nintendo", providerUrl: url };
  Object.assign(fixture.sourceTables.games[0].data, {
    cover: {
      provider: "nintendo",
      providerUrl: url,
    },
  });
  const snapshot = parseBackupSnapshot(JSON.stringify(fixture));
  expect(snapshot.records[0].cover?.providerUrl).toBe(url);
  expect(snapshot.sourceTables.games[0].data.cover).toEqual({
    provider: "nintendo",
    providerUrl: url,
  });
  expect(restoreSql(snapshot, target).sql).toContain(url);
});

it("round-trips ordered game series in version 7 and remaps owner on restore", () => {
  const old = backupFixture();
  const seriesId = "56565656-5656-4656-8656-565656565656";
  const fixture = {
    ...old,
    version: 7 as const,
    sourceTables: {
      ...old.sourceTables,
      data_check_preferences: [],
      data_check_dismissals: [],
      game_series: [
        {
          id: seriesId,
          owner_id: old.ownerId,
          name: "Saga",
          updated_at: "2026-10-21T06:00:00Z",
        },
      ],
      game_series_members: [
        {
          owner_id: old.ownerId,
          series_id: seriesId,
          game_id: old.sourceTables.games[0].id,
          position: 0,
        },
      ],
    },
  };
  const parsed = parseBackupSnapshot(JSON.stringify(fixture));
  const restored = restoreSql(parsed, target);
  expect(restored.sql).toContain("insert into public.game_series ");
  expect(restored.sql).toContain("insert into public.game_series_members ");
  expect(restored.sql).toContain(target);
  expect(restored.summary.series).toBe(1);
});

it("validates unique membership positions while allowing gaps after game deletion", () => {
  const old = backupFixture();
  const seriesId = "56565656-5656-4656-8656-565656565656";
  const gameId2 = "67676767-6767-4676-8676-676767676767";
  const fixture = {
    ...old,
    version: 7 as const,
    sourceTables: {
      ...old.sourceTables,
      data_check_preferences: [],
      data_check_dismissals: [],
      games: [
        ...old.sourceTables.games,
        {
          id: gameId2,
          owner_id: old.ownerId,
          data: {},
          created_at: "2026-10-21T06:00:00Z",
        },
      ],
      game_series: [
        {
          id: seriesId,
          owner_id: old.ownerId,
          name: "Saga",
          updated_at: "2026-10-21T06:00:00Z",
        },
      ],
      game_series_members: [
        {
          owner_id: old.ownerId,
          series_id: seriesId,
          game_id: old.sourceTables.games[0].id,
          position: 0,
        },
        {
          owner_id: old.ownerId,
          series_id: seriesId,
          game_id: gameId2,
          position: 2,
        },
      ],
    },
  };
  expect(
    parseBackupSnapshot(
      JSON.stringify(fixture),
    ).sourceTables.game_series_members.map((m) => m.position),
  ).toEqual([0, 2]);
  fixture.sourceTables.game_series_members[1].position = 0;
  expect(() => parseBackupSnapshot(JSON.stringify(fixture))).toThrow(
    /relaciones incompletas/,
  );
});
