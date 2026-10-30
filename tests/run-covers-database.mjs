import fs from "node:fs";
import { disposableDatabase } from "./support/disposable-db.mjs";
import { backupFixture } from "./fixtures/backup.ts";
import { restoreSql } from "../src/lib/backups/restore.ts";

await disposableDatabase((sql) => {
  sql(fs.readFileSync("tests/covers.integration.sql", "utf8"));
  sql(fs.readFileSync("tests/rls.integration.sql", "utf8"));
  sql(fs.readFileSync("tests/releases.integration.sql", "utf8"));
  const snapshot = backupFixture();
  const providerUrl =
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg";
  const overrideUrl =
    "https://assets.nintendo.com/image/upload/manual.jpg";
  const cover = { provider: "steam", providerUrl, overrideUrl };
  snapshot.records[0].cover = cover;
  Object.assign(snapshot.sourceTables.games[0].data, { cover });
  const targetOwner = "88888888-8888-4888-8888-888888888888";
  sql(
    "insert into auth.users(id,email) values('" +
      targetOwner +
      "','cover-restore@example.invalid');insert into public.members(id,display_name) values('" +
      targetOwner +
      "','Cover restore target');",
  );
  sql(restoreSql(snapshot, targetOwner).sql);
  const restored = JSON.parse(
    sql(
      "select jsonb_build_object('owner',owner_id,'cover',data->'cover')::text from public.games where owner_id='" +
        targetOwner +
        "'",
    ),
  );
  if (
    restored.owner !== targetOwner ||
    restored.cover.providerUrl !== providerUrl ||
    restored.cover.overrideUrl !== overrideUrl
  )
    throw Error("Cover fields did not survive backup restore.");
});
