import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";
import { castingSessions, generationJobs } from "./generation-schema";
import { entitlementReservations } from "./payment-schema";

export const deepReadingContextSnapshots = pgTable(
  "deep_reading_context_snapshots",
  {
    castingId: uuid("casting_id").primaryKey().references(() => castingSessions.id, { onDelete: "cascade" }),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    encryptionKeyVersion: text("encryption_key_version").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const questionLocks = pgTable(
  "question_locks",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    keyVersion: text("key_version").notNull(),
    winningCastingId: uuid("winning_casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("question_locks_winning_casting_idx").on(table.winningCastingId),
    index("question_locks_locked_until_idx").on(table.lockedUntil),
  ],
);

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
