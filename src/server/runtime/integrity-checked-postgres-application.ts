import { PostgresApplicationRuntime } from "./postgres-application";
import { PostgresResultIntegrityService } from "./postgres-result-integrity";

export class IntegrityCheckedPostgresApplication extends PostgresApplicationRuntime {
  constructor(
    dependencies: ConstructorParameters<typeof PostgresApplicationRuntime>[0],
    private readonly resultIntegrity: PostgresResultIntegrityService,
  ) {
    super(dependencies);
  }

  override async recordCoinLine(
    input: Parameters<PostgresApplicationRuntime["recordCoinLine"]>[0],
  ) {
    const outcome = await super.recordCoinLine(input);
    if (outcome.completed) await this.resultIntegrity.seal(input.castingId);
    return outcome;
  }

  override async completeYarrow(
    input: Parameters<PostgresApplicationRuntime["completeYarrow"]>[0],
  ) {
    const outcome = await super.completeYarrow(input);
    await this.resultIntegrity.seal(input.castingId);
    return outcome;
  }

  override async recordMeiHua(
    input: Parameters<PostgresApplicationRuntime["recordMeiHua"]>[0],
  ) {
    const outcome = await super.recordMeiHua(input);
    await this.resultIntegrity.seal(input.castingId);
    return outcome;
  }

  override async loadCastingSnapshot(
    input: Parameters<PostgresApplicationRuntime["loadCastingSnapshot"]>[0],
  ) {
    const snapshot = await super.loadCastingSnapshot(input);
    if (snapshot?.result) await this.resultIntegrity.assertValid(input.castingId);
    return snapshot;
  }

  override async startLoginIntent(
    input: Parameters<PostgresApplicationRuntime["startLoginIntent"]>[0],
  ) {
    await this.resultIntegrity.assertValid(input.castingId);
    return super.startLoginIntent(input);
  }

  override async consumeLoginIntentAndReveal(
    input: Parameters<PostgresApplicationRuntime["consumeLoginIntentAndReveal"]>[0],
  ) {
    await this.resultIntegrity.assertIntentValid(input.intentId);
    return super.consumeLoginIntentAndReveal(input);
  }
}
