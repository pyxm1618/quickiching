import { getPostgresClient } from "@/server/db/client";
import { resolveWaffoRuntimeConfig } from "@/server/payments/waffo-adapter";
import { createWaffoAuthority } from "@/server/payments/waffo-authority";
import { PostgresRefundRepository } from "./postgres-refund-repository";
import { createRefundCommandService } from "./refund-command-service";

export function createProductionRefundRepository() {
  return new PostgresRefundRepository(getPostgresClient());
}

export function createProductionRefundCommandService() {
  const repository = createProductionRefundRepository();
  const waffo = resolveWaffoRuntimeConfig(process.env);
  return createRefundCommandService({
    repository,
    provider: createWaffoAuthority(waffo),
    storeId: waffo.storeId,
  });
}
