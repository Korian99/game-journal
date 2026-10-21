import fs from "node:fs";
import path from "node:path";
import { verifyBackupBundle } from "../src/lib/backups/bundle";
import { restoreSql } from "../src/lib/backups/restore";
const args = process.argv.slice(2);
function argument(name: string) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
if (args.includes("--help")) {
  console.log(
    "npm run backup:restore -- --json backup.json --excel backup.xlsx --manifest backup.manifest.json --owner TARGET_UUID [--write-sql review.sql]\nWithout --write-sql this only validates checksums and prints a dry-run summary. It never connects to a database.",
  );
  process.exit(0);
}
try {
  const json = argument("--json"),
    excel = argument("--excel"),
    manifest = argument("--manifest"),
    owner = argument("--owner");
  if (!json || !excel || !manifest || !owner)
    throw Error(
      "Indicá --json, --excel, --manifest y --owner. Usá --help para ver el formato.",
    );
  const snapshot = verifyBackupBundle(
    fs.readFileSync(json),
    fs.readFileSync(excel),
    fs.readFileSync(manifest),
  );
  const result = restoreSql(snapshot, owner);
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        verified: true,
        ...result.summary,
        notificationsEnabled: false,
        storeWatchesEnabled: false,
      },
      null,
      2,
    ),
  );
  const output = argument("--write-sql");
  if (output) {
    const target = path.resolve(output);
    fs.writeFileSync(target, result.sql, { flag: "wx" });
    console.log("SQL generado para revisar: " + target);
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "No se pudo validar el respaldo.",
  );
  process.exitCode = 1;
}
