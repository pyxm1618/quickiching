import { sleep } from "workflow";
import { getCommercialDatabaseConnection } from "@/server/db/client";
import { createOutboxDispatcher } from "./outbox-dispatcher";
import { PostgresPaymentRepository } from "./postgres-repository";

export type PaymentOutboxWorkflowInput = { inboxId: string };

type OutboxState = {
  status: string;
  attemptCount: number;
};

export async function dispatchPendingPaymentOutboxStep(inboxId: string): Promise<OutboxState> {
  "use step";
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");
  const { client } = getCommercialDatabaseConnection(url);
  const dispatcher = createOutboxDispatcher({
    sql: client,
    repository: new PostgresPaymentRepository(client),
  });
  await dispatcher.dispatchAllPending({ batchSize: 20, maxBatches: 5 });
  const rows = await client`
    select status, attempt_count
    from payment_outbox where inbox_id = ${inboxId} limit 1
  ` as Array<{ status: string; attempt_count: number }>;
  if (!rows[0]) throw new Error("PAYMENT_OUTBOX_UNAVAILABLE");
  return { status: rows[0].status, attemptCount: Number(rows[0].attempt_count) };
}

export async function paymentOutboxWorkflow(input: PaymentOutboxWorkflowInput) {
  "use workflow";

  for (let pass = 0; pass < 5; pass += 1) {
    const state = await dispatchPendingPaymentOutboxStep(input.inboxId);
    if (state.status === "completed" || state.status === "dead_letter") return state;
    if (state.attemptCount >= 3 && state.status !== "processing") {
      // One more pass lets claimBatch perform the deterministic dead-letter transition.
      continue;
    }
    await sleep(state.status === "processing" ? "35 seconds" : "5 seconds");
  }

  // Daily Reconcile remains a Hobby-plan-compatible final safety net. The
  // normal second/minute retry path above is durable and does not depend on Cron.
  return dispatchPendingPaymentOutboxStep(input.inboxId);
}
