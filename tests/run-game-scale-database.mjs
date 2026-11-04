import fs from "node:fs";
import { disposableDatabase } from "./support/disposable-db.mjs";

await disposableDatabase((sql) => {
  sql(fs.readFileSync("tests/game-scale.integration.sql", "utf8"));
});
console.log("Game production scale database integration passed.");
