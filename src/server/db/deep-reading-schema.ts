import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { castingSessions, generationJobs } from "./generation-schema";
import { entitlementReservations } from "./payment-schema";

export const deepReadingResults = pgTable(
  "deep_reading_results",
  {
    castingId: uuid("casting_id").primaryKey().references(() => castingSessions.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().unique().references(() => generationJobs.id, { onDelete: "restrict" }),
    reservationId: uuid("reservation_id").notNull().unique().references(() => entitlementReservations.id, { onDelete: "restrict" }),
    output: jsonb("output").notNull(),
    schemaVersion: text("schema_version").notNull(),
    promptVersion: text("prompt_version").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    integrityHash: text("integrity_hash").notNull(),
    integrityKeyVersion: text("integrity_key_version").notNull(),
    persistedAt: timestamp("persisted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("deep_reading_results_job_idx").on(table.jobId),
    index("deep_reading_results_reservation_idx").on(table.reservationId),
  ],
);
