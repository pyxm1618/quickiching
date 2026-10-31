export type AccountSurface = "account" | "settings";
export const ACCOUNT_OPEN_EVENT = "quickiching:open-account";
export function openAccountSurface(surface: AccountSurface): void {
  window.dispatchEvent(new CustomEvent(ACCOUNT_OPEN_EVENT, { detail: surface }));
}
