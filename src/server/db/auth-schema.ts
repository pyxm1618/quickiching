import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// These four tables are intentionally shaped to Better Auth 1.7.1's current
// PostgreSQL adapter contract. The exported authSchema keys are singular
// Better Auth model names; the SQL tables remain plural application tables.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ...timestamps,
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("accounts_issuer_account_id_idx").on(table.issuer, table.accountId),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const loginIntents = pgTable(
  "login_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Kept nullable as the CP2 basis must support targets that are not yet
    // represented by the deferred Public/Commercial casting tables.
    castingId: uuid("casting_id"),
    targetResource: text("target_resource").notNull(),
    anonymousHash: text("anonymous_hash").notNull(),
    callbackPath: text("callback_path").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedUserId: text("consumed_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("login_intents_owner_idx").on(table.anonymousHash),
    index("login_intents_expiry_idx").on(table.expiresAt),
  ],
);

// Explicit singular keys prevent an accidental model/table-name mismatch in
// the Better Auth Drizzle adapter. Do not replace this with a plural inference.
export const authSchema = Object.freeze({
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
});

export const authTables = Object.freeze({
  users,
  sessions,
  accounts,
  verifications,
  loginIntents,
});

export type AuthSchema = typeof authSchema;
