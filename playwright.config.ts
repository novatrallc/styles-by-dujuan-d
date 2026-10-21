import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./tests", testMatch: "*.spec.ts", use: { baseURL: "http://127.0.0.1:3000", ...devices["Desktop Chrome"] }, webServer: { command: "npm run dev -- --hostname 127.0.0.1", url: "http://127.0.0.1:3000/api/health", reuseExistingServer: !process.env.CI, timeout: 120000 } });
