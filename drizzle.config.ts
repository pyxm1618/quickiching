import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // CP2 migrates only the identity/Login Intent boundary. Payment, AI,
  // workflow, and future casting tables remain deferred to their checkpoints.
  schema: "./src/server/db/auth-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
});
