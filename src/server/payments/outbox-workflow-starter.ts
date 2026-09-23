import { start } from "workflow/api";
import { paymentOutboxWorkflow } from "./outbox-workflow";

export async function startPaymentOutboxWorkflow(inboxId: string): Promise<string> {
  const run = await start(paymentOutboxWorkflow, [{ inboxId }]);
  return run.runId;
}
