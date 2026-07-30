import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { AsyncIdentityRepository } from "./ports";
import { mapUser, postgresId } from "./helpers";

export class PostgresIdentityRepository implements AsyncIdentityRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async createUser(email: string, now: Date) {
    const normalized = email.trim().toLowerCase();
    const [created] = await this.database.insert(users).values({
      id: postgresId("usr"),
      email: normalized,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: sql`lower(${users.email})`,
      set: { updatedAt: now },
    }).returning();
    return mapUser(created);
  }

  async getUser(userId: string) {
    const [row] = await this.database.select().from(users).where(eq(users.id, userId)).limit(1);
    return row ? mapUser(row) : undefined;
  }

  async getUserByEmail(email: string) {
    const [row] = await this.database.select().from(users)
      .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);
    return row ? mapUser(row) : undefined;
  }
}
