import fs from "node:fs";
const domain = fs
  .readFileSync("src/lib/domain.ts", "utf8")
  .replace('from "./types"', 'from "./types.ts"');
fs.writeFileSync("supabase/functions/price-worker/domain.ts", domain);
fs.copyFileSync("src/lib/types.ts", "supabase/functions/price-worker/types.ts");
console.log("Worker domain synchronized.");
