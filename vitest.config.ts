import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Integration suites are run only by test:postgres:serial against an
    // explicitly-created temporary PostgreSQL 16 cluster.
    exclude: process.env.VITEST_INTEGRATION ? [] : ["**/*.integration.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
