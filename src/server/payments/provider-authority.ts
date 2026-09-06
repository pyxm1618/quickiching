export type ProviderEnvironment = "test" | "prod";

export type AuthoritativePayment = {
  environment: ProviderEnvironment;
  storeId: string;
  model: "one_time";
  merchantOrderReference: string;
  providerOrderId: string;
  providerPaymentId: string;
  providerProductId: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  amountMinor: number;
  currency: "USD";
};

export type AuthoritativePaymentLookup =
  | { status: "found"; payment: AuthoritativePayment }
  | { status: "not_found" }
  | { status: "ambiguous" }
  | { status: "contract_error" };

export type RefundWriteResult = {
  providerTicketId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
};

export type RefundSettlementLookup =
  | {
      status: "found_pending" | "found_processing" | "succeeded" | "failed";
      providerTicketId: string;
      providerRefundId: string | null;
      amountMinor: number;
      currency: "USD";
    }
  | { status: "not_found" | "ambiguous" | "contract_error" };

export interface OneTimePaymentAuthority {
  getPayment(input: {
    environment: ProviderEnvironment;
    storeId: string;
    merchantOrderReference: string;
    providerPaymentId?: string;
    expectedProviderProductId: string;
    expectedAmountMinor: number;
    expectedCurrency: "USD";
    signal?: AbortSignal;
  }): Promise<AuthoritativePaymentLookup>;
}

export interface RefundProviderAuthority extends OneTimePaymentAuthority {
  requestRefund(input: {
    environment: ProviderEnvironment;
    storeId: string;
    buyerIdentity: string;
    providerPaymentId: string;
    merchantOrderReference: string;
    amountMinor: number;
    currency: "USD";
    reason: string;
    refundIntentId: string;
  }): Promise<RefundWriteResult>;

  getRefundSettlement(input: {
    environment: ProviderEnvironment;
    storeId: string;
    providerPaymentId: string;
    merchantOrderReference: string;
    expectedProviderProductId: string;
    paymentAmountMinor: number;
    amountMinor: number;
    currency: "USD";
    refundIntentId: string;
    providerTicketId?: string;
    signal?: AbortSignal;
  }): Promise<RefundSettlementLookup>;
}
