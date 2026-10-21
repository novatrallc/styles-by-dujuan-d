import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], exclude: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx", "node_modules/**", ".next/**"] },
});
