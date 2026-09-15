import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const workflowRunStatus = pgEnum("workflow_run_status", [
  "start_pending",
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    workflowName: text("workflow_name").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    providerRunId: text("provider_run_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    status: workflowRunStatus("status").notNull().default("pending"),
    errorCode: text("error_code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workflow_runs_idempotency_idx").on(table.idempotencyKey),
    index("workflow_runs_entity_idx").on(table.entityType, table.entityId),
    index("workflow_runs_status_idx").on(table.status, table.updatedAt),
    check("workflow_runs_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);
