/**
 * Explicit flow-exit marker.
 *
 * Navigation / Surface Authority: an explicit Exit from a flow must land on the
 * flow's declared landing surface and must not bounce the visitor straight back
 * into the active flow. The underlying reading session is deliberately left
 * untouched — clearing and resume policy belong to Reading Lifecycle, not to
 * navigation.
 *
 * This marker is navigation-only. It is NOT a passive-resume implementation:
 * it adds no Resume/Continue affordance and does not change what a direct Home
 * entry does with a stored partial. The full Passive Resume contract is owned
 * by PR #117 (`fix/reading-lifecycle-remediation-1` @ 4593bc60, contract C1),
 * which is an EXTERNAL MERGE DEPENDENCY and must land before this PR is merged.
 *
 * The marker is a one-shot signal consumed by the landing surface itself.
 */
const STORAGE_KEY = "quickiching:navigation:explicit-flow-exit";

export function rememberExplicitFlowExit(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // A blocked session store must never block the exit itself.
  }
}

export function consumeExplicitFlowExit(): boolean {
  try {
    const marker = window.sessionStorage.getItem(STORAGE_KEY);
    if (!marker) return false;
    window.sessionStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
