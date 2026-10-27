import {
  dataCheckPreferencesSchema,
  dismissalSchema,
} from "../journal/data-checks";
import JSZip from "jszip";
import { scoringEntrySchema } from "../scoring-guide";
import { createHash } from "node:crypto";
import { z } from "zod";
import { excelExport, type ExportData } from "../export";
import { journalEntrySchema, offerSchema } from "../contracts";
const id = z.uuid(),
  text = z.string(),
  row = z.object({ id, owner_id: id }).passthrough();
const historySchema = row.extend({
  offer_id: id,
  price: z.number().finite(),
  currency: text,
  discount: z.number().finite(),
  created_at: text,
});
const playthroughSchema = row.extend({
  game_id: id,
  data: z.record(text, z.unknown()),
  source_snapshot: z.record(text, z.unknown()).default({}),
  source_key: text.nullable().default(null),
  updated_at: text,
  deleted_at: text.nullable().default(null),
});
export const backupSnapshotSchema = z
  .strictObject({
    version: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
    kind: z.literal("game-journal-daily"),
    ownerId: id,
    exportedAt: text,
    records: z.array(journalEntrySchema),
    trash: z
      .array(journalEntrySchema.and(z.object({ deleted_at: text })))
      .default([]),
    offers: z.array(offerSchema.and(row)),
    priceHistory: z.array(historySchema),
    sourceTables: z.strictObject({
      games: z.array(row.extend({ data: z.record(text, z.unknown()) })),
      playthroughs: z.array(playthroughSchema),
      imports: z.array(row),
      shared_entries: z.array(row.extend({ entry_id: id, recipient_id: id })),
      notifications: z.array(row),
      scoring_guide: z
        .array(scoringEntrySchema.extend({ owner_id: id }))
        .max(101)
        .default([]),
      data_check_preferences: z
        .array(dataCheckPreferencesSchema.extend({ owner_id: id }))
        .max(1)
        .optional(),
      data_check_dismissals: z
        .array(
          z.strictObject({
            owner_id: id,
            entry_id: id,
            kind: dismissalSchema.shape.kind,
            field_values: dismissalSchema.shape.values,
          }),
        )
        .optional(),
      notification_preferences: z
        .object({ owner_id: id })
        .passthrough()
        .nullable(),
      member: z
        .object({
          id,
          display_name: text,
          role: z.enum(["admin", "member"]),
          active: z.boolean(),
        })
        .passthrough(),
    }),
  })
  .superRefine((snapshot, ctx) => {
    if (
      snapshot.version === 6 &&
      (!snapshot.sourceTables.data_check_preferences ||
        !snapshot.sourceTables.data_check_dismissals)
    )
      ctx.addIssue({
        code: "custom",
        message: "Missing version 6 data-check state",
      });
  })
  .transform((snapshot) => ({
    ...snapshot,
    sourceTables: {
      ...snapshot.sourceTables,
      data_check_preferences:
        snapshot.sourceTables.data_check_preferences ?? [],
      data_check_dismissals: snapshot.sourceTables.data_check_dismissals ?? [],
    },
  }));
export type BackupSnapshot = z.infer<typeof backupSnapshotSchema>;
export function sha256(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function parseBackupSnapshot(source: string): BackupSnapshot {
  const snapshot = backupSnapshotSchema.parse(JSON.parse(source) as unknown);
  const owner = snapshot.ownerId;
  const owned = [
    ...snapshot.sourceTables.games,
    ...snapshot.sourceTables.playthroughs,
    ...snapshot.sourceTables.imports,
    ...snapshot.sourceTables.shared_entries,
    ...snapshot.sourceTables.notifications,
    ...snapshot.sourceTables.scoring_guide,
    ...snapshot.sourceTables.data_check_preferences,
    ...snapshot.sourceTables.data_check_dismissals,
    ...snapshot.offers,
    ...snapshot.priceHistory,
  ];
  if (
    owned.some((row) => row.owner_id !== owner) ||
    snapshot.sourceTables.member.id !== owner ||
    (snapshot.sourceTables.notification_preferences &&
      snapshot.sourceTables.notification_preferences.owner_id !== owner)
  )
    throw Error("El respaldo contiene filas de otro propietario.");
  const games = new Set(snapshot.sourceTables.games.map((row) => row.id)),
    plays = new Set(snapshot.sourceTables.playthroughs.map((row) => row.id)),
    offers = new Set(snapshot.offers.map((row) => row.id));
  if (
    snapshot.sourceTables.playthroughs.some((row) => !games.has(row.game_id)) ||
    snapshot.offers.some((row) => !games.has(row.game_id)) ||
    snapshot.priceHistory.some((row) => !offers.has(row.offer_id)) ||
    snapshot.sourceTables.shared_entries.some(
      (row) => !plays.has(row.entry_id),
    ) ||
    snapshot.sourceTables.data_check_dismissals.some(
      (row) => !plays.has(row.entry_id),
    )
  )
    throw Error("El respaldo contiene relaciones incompletas.");
  if (
    [...snapshot.records, ...snapshot.trash].some(
      (record) =>
        !record.id ||
        !plays.has(record.id) ||
        !record.gameId ||
        !games.has(record.gameId),
    )
  )
    throw Error("El respaldo contiene entradas sin sus filas originales.");
  const dismissalKeys = snapshot.sourceTables.data_check_dismissals.map(
    (row) => row.entry_id + ":" + row.kind,
  );
  if (new Set(dismissalKeys).size !== dismissalKeys.length)
    throw Error("El respaldo contiene avisos ocultos duplicados.");
  return snapshot;
}
const artifactSchema = z.object({
  name: text,
  size: z.number().int().nonnegative(),
  sha256: text.regex(/^[a-f0-9]{64}$/),
});
export const manifestSchema = z.strictObject({
  formatVersion: z.literal(1),
  kind: z.literal("game-journal-backup-bundle"),
  snapshotId: id,
  sourceVersion: z.number(),
  ownerId: id,
  capturedAt: text,
  files: z.strictObject({ json: artifactSchema, excel: artifactSchema }),
});
export type BackupManifest = z.infer<typeof manifestSchema>;
export type BackupArtifact = {
  name: string;
  mime: string;
  bytes: Uint8Array;
  sha256: string;
};
export async function buildBackupBundle(
  snapshotText: string,
  snapshotId: string,
) {
  z.uuid().parse(snapshotId);
  const snapshot = parseBackupSnapshot(snapshotText);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(snapshot.exportedAt));
  const part = (kind: string) =>
    parts.find((part) => part.type === kind)!.value;
  const prefix =
    "game-journal-" +
    part("year") +
    "-" +
    part("month") +
    "-" +
    part("day") +
    "-" +
    snapshotId;
  const artifact = (
    suffix: string,
    mime: string,
    bytes: Uint8Array,
  ): BackupArtifact => ({
    name: prefix + suffix,
    mime,
    bytes,
    sha256: sha256(bytes),
  });
  const json = artifact(
    ".json",
    "application/json",
    Buffer.from(snapshotText, "utf8"),
  );
  const data: ExportData = {
    records: snapshot.records,
    offers: snapshot.offers,
    priceHistory: snapshot.priceHistory,
    exportedAt: snapshot.exportedAt,
    trash: snapshot.trash,
    scoringGuide: snapshot.sourceTables.scoring_guide,
  };
  const zip = await JSZip.loadAsync(await excelExport(data));
  const captured = new Date(snapshot.exportedAt);
  Object.values(zip.files).forEach((file) => {
    file.date = captured;
  });
  const excel = artifact(
    ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      platform: "DOS",
    }),
  );
  const value: BackupManifest = {
    formatVersion: 1,
    kind: "game-journal-backup-bundle",
    snapshotId,
    sourceVersion: snapshot.version,
    ownerId: snapshot.ownerId,
    capturedAt: snapshot.exportedAt,
    files: {
      json: { name: json.name, size: json.bytes.length, sha256: json.sha256 },
      excel: {
        name: excel.name,
        size: excel.bytes.length,
        sha256: excel.sha256,
      },
    },
  };
  return {
    json,
    excel,
    manifest: {
      ...artifact(
        ".manifest.json",
        "application/json",
        Buffer.from(JSON.stringify(value, null, 2), "utf8"),
      ),
      value,
    },
  };
}
export function verifyBackupBundle(
  json: Uint8Array,
  excel: Uint8Array,
  manifestBytes: Uint8Array,
) {
  const manifest = manifestSchema.parse(
    JSON.parse(Buffer.from(manifestBytes).toString("utf8")) as unknown,
  );
  for (const [name, bytes] of [
    ["json", json],
    ["excel", excel],
  ] as const) {
    if (
      bytes.length !== manifest.files[name].size ||
      sha256(bytes) !== manifest.files[name].sha256
    )
      throw Error("Backup checksum mismatch: " + name);
  }
  const snapshot = parseBackupSnapshot(Buffer.from(json).toString("utf8"));
  if (
    snapshot.ownerId !== manifest.ownerId ||
    snapshot.exportedAt !== manifest.capturedAt ||
    snapshot.version !== manifest.sourceVersion
  )
    throw Error("El manifiesto no corresponde al respaldo.");
  return snapshot;
}
