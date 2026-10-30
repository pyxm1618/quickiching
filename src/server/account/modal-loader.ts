import { getCurrentUser } from "@/lib/auth/session";
import { loadEntitlementBalance } from "@/server/loaders";
import { loadAccountPurchases } from "./purchase-loader";
import { loadSignInMethods } from "./sign-in-method-loader";

/** Loaded on opening My Account; no account data is prefetched into the header. */
export async function loadAccountModal(resolvedUser?: { id: string; email: string }) {
  const user = resolvedUser ?? await getCurrentUser();
  if (!user) throw new Error("ACCOUNT_SESSION_REQUIRED");
  const [balance, purchases, signInMethods] = await Promise.all([
    loadEntitlementBalance(user), loadAccountPurchases(user), loadSignInMethods(user),
  ]);
  return { email: user.email, balance, purchases, signInMethods };
}
