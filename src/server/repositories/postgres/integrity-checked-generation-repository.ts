import type { Sql } from "postgres";
import { DomainError } from "@/server/errors/domain-error";
import { PostgresResultIntegrityService } from "@/server/runtime/postgres-result-integrity";
import { PostgresGenerationRepository } from "./generation-repository";

export class IntegrityCheckedPostgresGenerationRepository extends PostgresGenerationRepository {
  constructor(
    private readonly sql: Sql,
    private readonly resultIntegrity: PostgresResultIntegrityService,
  ) {
    super(sql);
  }

  override async enqueuePreview(
    input: Parameters<PostgresGenerationRepository["enqueuePreview"]>[0],
  ) {
    await this.assertAuthorized(input.castingId, input.userId);
    await this.resultIntegrity.assertValid(input.castingId);
    return super.enqueuePreview(input);
  }

  override async enqueueDeepReading(
    input: Parameters<PostgresGenerationRepository["enqueueDeepReading"]>[0],
  ) {
    await this.assertAuthorized(input.castingId, input.userId);
    await this.resultIntegrity.assertValid(input.castingId);
    return super.enqueueDeepReading(input);
  }

  private async assertAuthorized(castingId: string, userId: string): Promise<void> {
    const rows = await this.sql`
      select 1 from casting_sessions
      where id = ${castingId} and user_id = ${userId}
        and lifecycle = 'revealed' and deleted_at is null
      limit 1
    `;
    if (!rows[0]) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
    }
  }
}
