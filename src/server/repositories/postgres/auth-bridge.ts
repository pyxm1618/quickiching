import type { Sql } from "postgres";

export class PostgresAuthBridge {
  constructor(private readonly sql: Sql) {}

  async ensureApplicationUser(input: { id: string; email: string }): Promise<void> {
    await this.sql`
      insert into users (id, email)
      values (${input.id}, ${input.email.trim().toLowerCase()})
      on conflict (id) do update set email = excluded.email
    `;
  }
}
