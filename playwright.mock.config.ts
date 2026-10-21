import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/mocked",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3102/tests/browser-fixture/",
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node tests/browser-fixture/server.mjs",
    url: "http://127.0.0.1:3102/tests/browser-fixture/",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
