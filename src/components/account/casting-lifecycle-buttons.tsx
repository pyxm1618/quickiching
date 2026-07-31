"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestCastingDeletionAction,
  restoreCastingAction,
} from "@/app/privacy-actions";
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
