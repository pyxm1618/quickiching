import { signCookie, verifyCookie } from "@/lib/crypto";
import { assertAllowedCallbackPath } from "./login-intent";

export type RevealAuthState = {
  intentId: string;
  nonce: string;
  callbackPath: string;
};

export function encodeRevealAuthState(state: RevealAuthState): string {
  const payload = Buffer.from(JSON.stringify({
    intentId: state.intentId,
    nonce: state.nonce,
    callbackPath: assertAllowedCallbackPath(state.callbackPath),
  }), "utf8").toString("base64url");
  return signCookie(payload);
}

export function decodeRevealAuthState(signed: string): RevealAuthState | null {
  const payload = verifyCookie(signed);
  if (!payload) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<RevealAuthState>;
    if (typeof value.intentId !== "string" || typeof value.nonce !== "string" || typeof value.callbackPath !== "string") {
      return null;
    }
    return {
      intentId: value.intentId,
      nonce: value.nonce,
      callbackPath: assertAllowedCallbackPath(value.callbackPath),
    };
  } catch {
    return null;
  }
}
