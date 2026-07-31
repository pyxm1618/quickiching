"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestAccountDeletionAction } from "@/app/privacy-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const CONFIRMATION = "DELETE MY ACCOUNT";

export function AccountDeletionPanel({ email }: { email: string }) {
  const router = useRouter();
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [phrase, setPhrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = emailConfirmation.trim().toLowerCase() === email.trim().toLowerCase()
    && phrase === CONFIRMATION;

  async function removeAccount() {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    const result = await requestAccountDeletionAction({
      email: emailConfirmation,
      confirmation: phrase,
    });
    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }
    router.replace(`/account-deleted?purgeAfter=${encodeURIComponent(result.value.contentPurgeAfter.toISOString())}`);
    router.refresh();
  }

  return (
    <section className="mt-16 border-t border-[var(--line)] pt-10">
      <h2 className="font-display text-2xl font-medium">Delete account</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--ink-2)]">
        This action signs you out immediately and cannot be reversed through the account interface.
      </p>
      <Card className="mt-5 border-[var(--danger)]/40">
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2 text-sm text-[var(--ink-2)]">
            <p>All casting, question, preview, and reading content is hidden immediately and physically removed after 30 days.</p>
            <p>Unused reading credits are revoked. Active quality reviews are closed and their free-text reason is removed.</p>
            <p>Orders, refund/dispute records, and the immutable entitlement ledger remain only as pseudonymous financial records.</p>
          </div>

          <label className="block text-sm">
            <span className="font-medium">Confirm account email</span>
            <input
              type="email"
              autoComplete="email"
              value={emailConfirmation}
              onChange={(event) => setEmailConfirmation(event.target.value)}
              className="mt-2 w-full rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2"
              placeholder={email}
              disabled={pending}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium">Type {CONFIRMATION}</span>
            <input
              type="text"
              autoComplete="off"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              className="mt-2 w-full rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 font-mono"
              disabled={pending}
            />
          </label>

          <Button
            type="button"
            variant="danger"
            disabled={!ready || pending}
            onClick={() => void removeAccount()}
          >
            {pending ? "Deleting account…" : "Permanently delete account"}
          </Button>
          {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
