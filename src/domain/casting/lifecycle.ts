import type { CastingLifecycle } from "./types";

// §7.1 Casting lifecycle state machine. Unknown or reverse transitions fail immediately.
// Risk, Preview, Reading, entitlement and quality-review states are orthogonal and never
// folded into this machine (§7, §6.3).

const ALLOWED: Record<CastingLifecycle, CastingLifecycle[]> = {
  draft: ["casting", "emergency_blocked", "cancelled", "user_deleted"],
  casting: ["awaiting_reveal", "expired"],
  awaiting_reveal: ["revealed", "discarded_duplicate", "expired"],
  revealed: ["user_deleted"],
  expired: [],
  cancelled: [],
  discarded_duplicate: [],
  emergency_blocked: [],
  user_deleted: [],
};

export function canTransition(from: CastingLifecycle, to: CastingLifecycle): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transition(
  from: CastingLifecycle,
  to: CastingLifecycle,
): CastingLifecycle {
  if (!canTransition(from, to)) {
    throw new Error(`CAST_INVALID_TRANSITION: ${from} -> ${to}`);
  }
  return to;
}

// Two 24h clocks (CAST-003). Both compared against DB now(); client clock is never trusted.
export type ClockCheck = {
  firstIrreversibleStepAt: Date | null;
  castingExpiresAt: Date | null;
  completedAt: Date | null;
  revealExpiresAt: Date | null;
  now: Date;
};

export type ClockVerdict = {
  castingExpired: boolean;
  revealExpired: boolean;
};

export function evaluateClocks(c: ClockCheck): ClockVerdict {
  const castingExpired =
    c.castingExpiresAt != null && c.now.getTime() > c.castingExpiresAt.getTime();
  const revealExpired =
    c.revealExpiresAt != null && c.now.getTime() > c.revealExpiresAt.getTime();
  return { castingExpired, revealExpired };
}
