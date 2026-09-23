import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // CP4 extends the immutable CP2/CP3 history with payment and entitlement persistence.
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
});
