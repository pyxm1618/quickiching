import type { PaymentEvent } from "./provider";

export interface PaymentEventRepository {
  claimEvent(event: PaymentEvent): Promise<boolean>;
  releaseEvent(event: PaymentEvent, error: unknown): Promise<void>;
  applyCheckoutCompleted(event: PaymentEvent): Promise<void>;
  applyRefund(event: PaymentEvent): Promise<void>;
  applyDispute(event: PaymentEvent): Promise<void>;
}

export class PaymentEventService {
  constructor(private readonly repository: PaymentEventRepository) {}

  async process(event: PaymentEvent): Promise<{ processed: boolean }> {
    const claimed = await this.repository.claimEvent(event);
    if (!claimed) return { processed: false };
    try {
      if (event.type === "checkout.completed") {
        await this.repository.applyCheckoutCompleted(event);
      } else if (event.type === "refund.created") {
        await this.repository.applyRefund(event);
      } else {
        await this.repository.applyDispute(event);
      }
      return { processed: true };
    } catch (error) {
      await this.repository.releaseEvent(event, error);
      throw error;
    }
  }
}
