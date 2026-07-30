"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestCastingDeletionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DeleteCastButton({ castingId }: { castingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function del() {
    setPending(true);
    const res = await requestCastingDeletionAction({ castingId });
    setPending(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/account"), 800);
    }
  }

  if (done) return <p className="text-sm text-[var(--ink-3)]">Deleted. Returning to history…</p>;
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={del}>
      {pending ? "Deleting…" : "Delete this cast"}
    </Button>
  );
}
