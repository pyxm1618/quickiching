import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";

export const auditCategory = pgEnum("audit_category", [
  "checkout",
  "webhook",
  "entitlement",
  "generation",
  "reconcile",
  "deletion",
  "capability",
]);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: auditCategory("category").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_category_created_idx").on(table.category, table.createdAt),
    index("audit_events_user_created_idx").on(table.userId, table.createdAt),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);
