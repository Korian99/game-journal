import fs from "node:fs";
import { getSeriesProgress } from "../src/features/library/series/series.ts";
import { disposableDatabase } from "./support/disposable-db.mjs";
await disposableDatabase(async (sql) => {
  sql(fs.readFileSync("tests/series.integration.sql", "utf8"));
  const { backupFixture } = await import("./fixtures/backup.ts");
  const { buildBackupBundle, verifyBackupBundle } =
    await import("../src/lib/backups/bundle.ts");
  const { restoreSql } = await import("../src/lib/backups/restore.ts");
  const targetOwner = "78787878-7878-4878-8878-787878787878";
  const snapshot = backupFixture();
  const secondGame = "23232323-2323-4323-8323-232323232324";
  const seriesId = "56565656-5656-4656-8656-565656565656";
  const v7 = {
    ...snapshot,
    version: 7,
    sourceTables: {
      ...snapshot.sourceTables,
      data_check_preferences: [],
      data_check_dismissals: [],
      games: [
        ...snapshot.sourceTables.games,
        {
          id: secondGame,
          owner_id: snapshot.ownerId,
          data: { title: "Continuación" },
          created_at: snapshot.exportedAt,
        },
      ],
      game_series: [
        {
          id: seriesId,
          owner_id: snapshot.ownerId,
          name: "Saga",
          updated_at: snapshot.exportedAt,
        },
      ],
      game_series_members: [
        {
          owner_id: snapshot.ownerId,
          series_id: seriesId,
          game_id: snapshot.sourceTables.games[0].id,
          position: 0,
        },
        {
          owner_id: snapshot.ownerId,
          series_id: seriesId,
          game_id: secondGame,
          position: 2,
        },
      ],
    },
  };
  const bundle = await buildBackupBundle(
    JSON.stringify(v7),
    "45454545-4545-4545-8545-454545454545",
  );
  const verified = verifyBackupBundle(
    bundle.json.bytes,
    bundle.excel.bytes,
    bundle.manifest.bytes,
  );
  const recovery = restoreSql(verified, targetOwner);
  sql(
    "insert into auth.users(id,email) values ('" +
      targetOwner +
      "','recovery@example.invalid'); insert into public.members(id,display_name) values ('" +
      targetOwner +
      "','Recovery');",
  );
  sql(recovery.sql);
  const rows = JSON.parse(
    sql(
      "select jsonb_build_object('series',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'owner_id',owner_id) order by id) from public.game_series),'members',(select jsonb_agg(jsonb_build_object('game_id',game_id,'position',position,'owner_id',owner_id) order by position) from public.game_series_members),'plays',(select count(*) from public.playthroughs)::int,'games',(select count(*) from public.games)::int)::text",
    ),
  );
  if (
    rows.series?.[0]?.owner_id !== targetOwner ||
    rows.series[0].name !== "Saga" ||
    rows.members?.map((m) => m.position).join(",") !== "0,2" ||
    rows.members.some((m) => m.owner_id !== targetOwner) ||
    rows.plays !== 1 ||
    rows.games !== 2
  )
    throw Error(
      "V7 SQL restore readback did not preserve owner, series, ordered membership, games, and playthroughs.",
    );
  const restoredRecords = JSON.parse(
    sql(
      "select coalesce(jsonb_agg(g.data || p.data || jsonb_build_object('gameId',g.id)), '[]'::jsonb)::text from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id where p.owner_id='" +
        targetOwner +
        "' and p.deleted_at is null",
    ),
  );
  const orderedIds = rows.members.map((member) => member.game_id);
  const before = getSeriesProgress(orderedIds, v7.records);
  const after = getSeriesProgress(orderedIds, restoredRecords);
  if (
    before.completed !== 1 ||
    after.completed !== before.completed ||
    after.total !== 2 ||
    after.next?.gameId !== secondGame
  )
    throw Error(
      "Restoring the series changed completed-game progress or the next ordered game.",
    );
});
console.log(
  "Series database and real version 7 SQL restore integration passed.",
);
