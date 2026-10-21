import { build, preview } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  outDir = path.join(root, "test-results/browser-app");
const options = {
  configFile: false,
  root,
  resolve: {
    alias: [
      {
        find: "@/lib/supabase/client",
        replacement: path.join(root, "tests/browser-fixture/client.ts"),
      },
      { find: "@", replacement: path.join(root, "src") },
    ],
  },
  define: {
    "process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID": "undefined",
    "process.env.NEXT_PUBLIC_GOOGLE_API_KEY": "undefined",
    "process.env.NEXT_PUBLIC_GOOGLE_APP_ID": "undefined",
  },
  esbuild: { jsx: "automatic" },
};
await build({
  ...options,
  logLevel: "error",
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(root, "tests/browser-fixture/index.html"),
    },
  },
});
await fs.copyFile(
  path.join(outDir, "tests/browser-fixture/index.html"),
  path.join(outDir, "index.html"),
);
const server = await preview({
  ...options,
  build: { outDir },
  preview: { host: "127.0.0.1", port: 3102, strictPort: true },
});
console.log("Mocked journal ready");
