import type { Sql } from "postgres";
import { PostgresResultIntegrityService } from "@/server/runtime/postgres-result-integrity";
import { PostgresGenerationRepository } from "./generation-repository";

export class IntegrityCheckedPostgresGenerationRepository extends PostgresGenerationRepository {
  constructor(
    sql: Sql,
    private readonly resultIntegrity: PostgresResultIntegrityService,
  ) {
    super(sql);
  }

  override async enqueuePreview(
    input: Parameters<PostgresGenerationRepository["enqueuePreview"]>[0],
  ) {
    await this.resultIntegrity.assertValid(input.castingId);
    return super.enqueuePreview(input);
  }

  override async enqueueDeepReading(
    input: Parameters<PostgresGenerationRepository["enqueueDeepReading"]>[0],
  ) {
    await this.resultIntegrity.assertValid(input.castingId);
    return super.enqueueDeepReading(input);
  }
}
