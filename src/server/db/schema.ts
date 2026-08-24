// CP3 is the first migration after CP2 that owns the commercial generation core.
// Keep the Better Auth tables exported from their CP2 module and expose one
// combined schema for Drizzle clients and migration drift checks.
export {
  accounts,
  authSchema,
  authTables,
  loginIntents,
  sessions,
  users,
  verifications,
} from "./auth-schema";
export {
  castResults,
  castingSessions,
  commercialCastingLifecycle,
  generationAttempts,
  generationJobs,
  generationJobStatus,
  generationKind,
  generationOutputReviews,
  generationSchema,
  outputReviewStatus,
  previewResults,
  questionVersions,
} from "./generation-schema";
export {
  entitlementBatches,
  entitlementLedger,
  entitlementLedgerAction,
  financialReviewStatus,
  paymentEnvironment,
  paymentFinancialReviews,
  paymentInboxStatus,
  paymentOrders,
  paymentOrderStatus,
  paymentOutbox,
  paymentOutboxStatus,
  paymentOutboxTopic,
  paymentProductKey,
  paymentSchema,
  paymentWebhookInbox,
} from "./payment-schema";

import { accounts, loginIntents, sessions, users, verifications } from "./auth-schema";
import {
  castResults,
  castingSessions,
  generationAttempts,
  generationJobs,
  generationOutputReviews,
  previewResults,
  questionVersions,
} from "./generation-schema";
import {
  entitlementBatches,
  entitlementLedger,
  paymentFinancialReviews,
  paymentOrders,
  paymentOutbox,
  paymentWebhookInbox,
} from "./payment-schema";

export const databaseSchema = Object.freeze({
  users,
  sessions,
  accounts,
  verifications,
  loginIntents,
  castingSessions,
  questionVersions,
  castResults,
  generationJobs,
  generationAttempts,
  previewResults,
  generationOutputReviews,
  paymentOrders,
  paymentWebhookInbox,
  paymentOutbox,
  entitlementBatches,
  entitlementLedger,
  paymentFinancialReviews,
});
