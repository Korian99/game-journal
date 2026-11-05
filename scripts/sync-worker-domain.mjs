import fs from "node:fs";
const priceParser = fs
  .readFileSync("src/features/stores/price-parser.ts", "utf8")
  .replace('from "../../lib/types"', 'from "./types.ts"');
const copies = [
  [
    "supabase/functions/price-worker/console-labels.ts",
    fs.readFileSync("src/lib/journal/console-labels.ts", "utf8"),
  ],
  [
    "supabase/functions/notification-worker/types.ts",
    fs.readFileSync("src/lib/types.ts", "utf8"),
  ],
  ["supabase/functions/price-worker/domain.ts", priceParser],
  [
    "supabase/functions/price-worker/types.ts",
    fs.readFileSync("src/lib/types.ts", "utf8"),
  ],
];
if (process.argv.includes("--check")) {
  for (const [file, content] of copies)
    if (
      fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n") !==
      content.replaceAll("\r\n", "\n")
    )
      throw Error(
        "Worker copy is outdated: " +
          file +
          ". Run node scripts/sync-worker-domain.mjs",
      );
  console.log("Worker domain matches the application.");
} else {
  for (const [file, content] of copies) fs.writeFileSync(file, content);
  console.log("Worker domain synchronized.");
}
