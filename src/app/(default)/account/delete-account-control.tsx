"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteAccountControl() {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = confirmation === "DELETE";

  async function deleteAccount() {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("ACCOUNT_DELETE_FAILED");
      window.location.assign("/");
    } catch {
      setError("Account deletion could not be completed. No deletion is assumed; please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--line)] p-4">
      <h3 className="font-display text-lg font-medium">Delete account</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-3)]">
        This permanently removes stored question text and generated reading content, signs you out,
        and anonymizes your account. Required financial and security records may be retained without your profile details.
      </p>
      <label className="mt-4 block text-sm font-medium" htmlFor="delete-account-confirmation">
        Type DELETE to confirm
      </label>
      <input
        id="delete-account-confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        className="mt-2 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm"
      />
      <Button className="mt-3" variant="outline" disabled={!confirmed || submitting} onClick={deleteAccount}>
        {submitting ? "Deleting…" : "Permanently delete account"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--cinnabar)]">{error}</p>}
    </div>
  );
}
