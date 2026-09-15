import { getPostgresClient } from "@/server/db/client";
import { resolveWaffoRuntimeConfig } from "@/server/payments/waffo-adapter";
import { createWaffoAuthority } from "@/server/payments/waffo-authority";
import { PostgresRefundDispatchOutcomeRepository } from "./postgres-refund-dispatch-outcomes";
import { PostgresRefundRepository } from "./postgres-refund-repository";
import { createRefundCommandService, type RefundCommandRepository } from "./refund-command-service";

export function createProductionRefundRepository() {
  return new PostgresRefundRepository(getPostgresClient());
}

export function createProductionRefundCommandService() {
  const sql = getPostgresClient();
  const repository = new PostgresRefundRepository(sql);
  const outcomes = new PostgresRefundDispatchOutcomeRepository(sql);
  const commandRepository: RefundCommandRepository = {
    claimProviderDispatch: repository.claimProviderDispatch.bind(repository),
    markProviderDispatchConfirmed: repository.markProviderDispatchConfirmed.bind(repository),
    markProviderDispatchAmbiguous: repository.markProviderDispatchAmbiguous.bind(repository),
    releaseProviderDispatchNotSent: outcomes.releaseProviderDispatchNotSent.bind(outcomes),
    markProviderDispatchRejected: outcomes.markProviderDispatchRejected.bind(outcomes),
  };
  const waffo = resolveWaffoRuntimeConfig(process.env);
  return createRefundCommandService({
    repository: commandRepository,
    provider: createWaffoAuthority(waffo),
    storeId: waffo.storeId,
  });
}
