import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // CP3 extends the immutable CP2 identity migration with the generation core.
  // Payment, Waffo, entitlement, and workflow tables remain deferred.
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
});
