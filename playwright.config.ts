import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3100", channel: process.env.PLAYWRIGHT_CHANNEL, trace: "retain-on-failure" },
  webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100", timeout: 90_000 },
});
