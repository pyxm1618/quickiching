import { PostgresApplicationRuntime } from "./postgres-application";
import { PostgresResultIntegrityService } from "./postgres-result-integrity";
import {
  allowAllMethodsPolicy,
  type MethodReleasePolicy,
} from "@/server/release/method-release";

export class IntegrityCheckedPostgresApplication extends PostgresApplicationRuntime {
  constructor(
    dependencies: ConstructorParameters<typeof PostgresApplicationRuntime>[0],
    private readonly resultIntegrity: PostgresResultIntegrityService,
    private readonly methodRelease: MethodReleasePolicy = allowAllMethodsPolicy,
  ) {
    super(dependencies);
  }

  override async createDraft(
    input: Parameters<PostgresApplicationRuntime["createDraft"]>[0],
  ) {
    this.methodRelease.assertReleased(input.method);
    return super.createDraft(input);
  }

  override async recordCoinLine(
    input: Parameters<PostgresApplicationRuntime["recordCoinLine"]>[0],
  ) {
    const outcome = await super.recordCoinLine(input);
    if (outcome.completed) await this.resultIntegrity.seal(input.castingId);
    return outcome;
  }

  override async recordYarrowChange(
    input: Parameters<PostgresApplicationRuntime["recordYarrowChange"]>[0],
  ) {
    this.methodRelease.assertReleased("yarrow_stalk");
    return super.recordYarrowChange(input);
  }

  override async completeYarrow(
    input: Parameters<PostgresApplicationRuntime["completeYarrow"]>[0],
  ) {
    this.methodRelease.assertReleased("yarrow_stalk");
    const outcome = await super.completeYarrow(input);
    await this.resultIntegrity.seal(input.castingId);
    return outcome;
  }

  override async recordMeiHua(
    input: Parameters<PostgresApplicationRuntime["recordMeiHua"]>[0],
  ) {
    this.methodRelease.assertReleased("mei_hua_current_time");
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
