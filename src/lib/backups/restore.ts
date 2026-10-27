import { z } from "zod";
import { parseBackupSnapshot, type BackupSnapshot } from "./bundle";
export function restoreSql(
  input: BackupSnapshot | unknown,
  targetOwner: string,
) {
  z.uuid().parse(targetOwner);
  const snapshot = parseBackupSnapshot(JSON.stringify(input));
  const tables = snapshot.sourceTables;
  const owned = <T extends { owner_id: string }>(rows: T[]) =>
    rows.map((row) => ({ ...row, owner_id: targetOwner }));
  const games = owned(tables.games),
    plays = owned(tables.playthroughs);
  const offers = owned(snapshot.offers).map((row) => ({
    ...row,
    watched: false,
    lease_until: null,
  }));
  const notifications = owned(tables.notifications).map((row) => ({
    ...row,
    read_at: new Date().toISOString(),
    delivered_at: new Date().toISOString(),
  }));
  const preferences = tables.notification_preferences
    ? [
        {
          ...tables.notification_preferences,
          owner_id: targetOwner,
          discounts: false,
          targets: false,
          releases: false,
          release_since: new Date().toISOString(),
        },
      ]
    : [];
  const sections: string[] = [
    "-- Game Journal recovery. Review the target connection before executing.",
    "-- Only INSERTs into an empty application database. Authentication and sharing are never recreated.",
    "begin;",
    "set local standard_conforming_strings=on;",
    "select pg_advisory_xact_lock(hashtextextended('game-journal-restore',0));",
    "do $$ begin",
    " if exists(select 1 from public.games) or exists(select 1 from public.playthroughs) or exists(select 1 from public.offers) or exists(select 1 from public.imports) or exists(select 1 from public.notifications) or exists(select 1 from public.scoring_guide) or exists(select 1 from public.data_check_preferences) or exists(select 1 from public.data_check_dismissals) then raise exception 'El proyecto de destino no está vacío';end if;",
    " if not exists(select 1 from public.members where id='" +
      targetOwner +
      "'::uuid and active) then raise exception 'Creá primero la cuenta invitada de destino';end if;",
    "end $$;",
  ];
  function insert(table: string, rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    const json = JSON.stringify(rows).replaceAll("'", "''");
    sections.push(
      "insert into public." +
        table +
        " select * from jsonb_populate_recordset(null::public." +
        table +
        ",'" +
        json +
        "'::jsonb);",
    );
  }
  insert("games", games);
  insert("playthroughs", plays);
  insert("offers", offers);
  insert("price_history", owned(snapshot.priceHistory));
  insert("imports", owned(tables.imports));
  insert("scoring_guide", owned(tables.scoring_guide));
  insert("data_check_preferences", owned(tables.data_check_preferences));
  insert("data_check_dismissals", owned(tables.data_check_dismissals));
  insert("notifications", notifications);
  if (preferences.length)
    sections.push(
      "update public.notification_preferences set discounts=false,targets=false,releases=false,release_since=clock_timestamp() where owner_id='" +
        targetOwner +
        "'::uuid;",
    );
  sections.push("commit;");
  return {
    sql: sections.join("\n") + "\n",
    summary: {
      games: games.length,
      playthroughs: plays.length,
      trash: plays.filter((row) => row.deleted_at != null).length,
      offers: offers.length,
      priceHistory: snapshot.priceHistory.length,
      imports: tables.imports.length,
      scoringGuide: tables.scoring_guide.length,
      dataCheckPreferences: tables.data_check_preferences.length,
      dataCheckDismissals: tables.data_check_dismissals.length,
      notifications: notifications.length,
      sharingDisabled: tables.shared_entries.length,
      targetOwner,
    },
  };
}
