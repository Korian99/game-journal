import { defineConfig } from "@playwright/test";
const proxyUrl = process.env.PLAYWRIGHT_PROXY_FROM_ENV
  ? (process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY)
  : undefined;
const proxy = proxyUrl ? new URL(proxyUrl) : null;
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/mocked/**",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    launchOptions: proxy
      ? {
          proxy: {
            server: proxy.protocol + "//" + proxy.host,
            bypass: "127.0.0.1,localhost",
            ...(proxy.username
              ? {
                  username: decodeURIComponent(proxy.username),
                  password: decodeURIComponent(proxy.password),
                }
              : {}),
          },
        }
      : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: true,
    timeout: 90000,
  },
});
