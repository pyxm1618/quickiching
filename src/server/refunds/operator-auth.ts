import { createHash, timingSafeEqual } from "node:crypto";

export type RefundOperatorAuthority = "decision" | "dispatch";

export type AuthenticatedRefundOperator = {
  operatorId: string;
  authority: RefundOperatorAuthority;
};

type RefundOperatorCredential = {
  operatorId: string;
  secret: string;
};

type RefundOperatorCredentialState = {
  valid: boolean;
  decision: RefundOperatorCredential[];
  dispatch: RefundOperatorCredential[];
};

const CREDENTIAL_ENV: Record<RefundOperatorAuthority, string> = {
  decision: "REFUND_DECISION_OPERATOR_CREDENTIALS",
  dispatch: "REFUND_DISPATCH_OPERATOR_CREDENTIALS",
};

function parseCredentialMap(raw: string | undefined): RefundOperatorCredential[] | null {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const credentials: RefundOperatorCredential[] = [];
    for (const [rawOperatorId, rawSecret] of Object.entries(parsed as Record<string, unknown>)) {
      const operatorId = rawOperatorId.trim();
      if (
        operatorId !== rawOperatorId
        || !/^[A-Za-z0-9][A-Za-z0-9._@:+-]{0,127}$/.test(operatorId)
        || typeof rawSecret !== "string"
        || !/^[\x21-\x7e]{16,256}$/.test(rawSecret)
      ) {
        return null;
      }
      credentials.push({ operatorId, secret: rawSecret });
    }
    return credentials;
  } catch {
    return null;
  }
}

function loadCredentialState(
  env: Record<string, string | undefined>,
): RefundOperatorCredentialState {
  const decision = parseCredentialMap(env[CREDENTIAL_ENV.decision]);
  const dispatch = parseCredentialMap(env[CREDENTIAL_ENV.dispatch]);
  if (!decision || !dispatch) return { valid: false, decision: [], dispatch: [] };

  const secrets = new Set<string>();
  for (const credential of [...decision, ...dispatch]) {
    if (secrets.has(credential.secret)) {
      return { valid: false, decision: [], dispatch: [] };
    }
    secrets.add(credential.secret);
  }
  return { valid: true, decision, dispatch };
}

function secretDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function refundOperatorCredentialConfigurationValid(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const state = loadCredentialState(env);
  return state.valid && state.decision.length > 0 && state.dispatch.length > 0;
}

export function refundOperatorAuthorityConfigured(
  authority: RefundOperatorAuthority,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const state = loadCredentialState(env);
  return state.valid && state[authority].length > 0;
}

export function authenticateRefundOperator(
  request: Request,
  authority: RefundOperatorAuthority,
  env: Record<string, string | undefined> = process.env,
): AuthenticatedRefundOperator | null {
  const state = loadCredentialState(env);
  if (!state.valid || state[authority].length === 0) return null;

  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.startsWith("Bearer ")) return null;
  const provided = authHeader.slice(7).trim();
  if (!provided) return null;

  const providedDigest = secretDigest(provided);
  let matchedOperatorId: string | null = null;
  for (const credential of state[authority]) {
    if (timingSafeEqual(providedDigest, secretDigest(credential.secret))) {
      if (matchedOperatorId != null) return null;
      matchedOperatorId = credential.operatorId;
    }
  }

  return matchedOperatorId == null
    ? null
    : { operatorId: matchedOperatorId, authority };
}
