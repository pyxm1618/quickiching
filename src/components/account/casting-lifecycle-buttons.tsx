"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestCastingDeletionAction,
  restoreCastingAction,
} from "@/app/actions";
import {
  requestAccountDeletionAction,
  restoreAccountAction,
} from "@/app/account/actions";
import { Button } from "@/components/ui/button";

export function DeleteCastingButton({ castingId }: { castingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setPending(true);
    setError(null);
    const result = await requestCastingDeletionAction({ castingId });
    setPending(false);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }
  return (
    <div className="text-right">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => void remove()}>
        {pending ? "Removing…" : "Delete"}
      </Button>
      {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

export function RestoreCastingButton({ castingId }: { castingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function restore() {
    setPending(true);
    setError(null);
    const result = await restoreCastingAction({ castingId });
    setPending(false);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }
  return (
    <div className="text-right">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => void restore()}>
        {pending ? "Restoring…" : "Restore"}
      </Button>
      {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

export function RequestAccountDeletionButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function requestDeletion() {
    if (!confirmed) {
      setError("Confirm that you understand sign-in sessions will be revoked immediately.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await requestAccountDeletionAction();
    setPending(false);
    if (!result.ok) return setError(result.error.message);
    router.replace("/signin?account=deletion_requested");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-[var(--ink-2)]">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1"
        />
        <span>
          I understand that all sessions will be revoked now, my account can be restored for 30 days,
          and personal casting content will be permanently purged after that deadline.
        </span>
      </label>
      <Button variant="destructive" disabled={pending} onClick={() => void requestDeletion()}>
        {pending ? "Scheduling deletion…" : "Delete account"}
      </Button>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

export function RestoreAccountButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setPending(true);
    setError(null);
    const result = await restoreAccountAction();
    setPending(false);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }

  return (
    <div>
      <Button variant="outline" disabled={pending} onClick={() => void restore()}>
        {pending ? "Restoring account…" : "Restore account"}
      </Button>
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
