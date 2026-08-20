"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { simulatePaymentAction } from "@/legacy/commercial/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SealMark } from "@/components/hex/seal-mark";

function SimulateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!orderId) {
      setStatus("error");
      setMessage("Missing order reference.");
      return;
    }
    (async () => {
      const res = await simulatePaymentAction({ orderId });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setMessage(res.error.message);
      }
    })();
  }, [orderId]);

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          {status === "loading" && (
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--ink-3)]">
              Processing payment…
            </p>
          )}
          {status === "done" && (
            <>
              <div className="mb-5 flex justify-center">
                <SealMark char="信" size="lg" tilt />
              </div>
              <h1 className="font-display text-2xl font-medium">Payment complete</h1>
              <p className="mt-2 text-sm text-[var(--ink-3)]">
                Your reading credits have been added. (Demo: no real charge was made.)
              </p>
              <Button className="mt-6" onClick={() => router.push("/account")}>
                Go to my account
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <h1 className="font-display text-2xl font-medium">Something went wrong</h1>
              <p className="mt-2 text-sm text-[var(--danger)]">{message}</p>
              <Button className="mt-6" variant="outline" onClick={() => router.push("/pricing")}>
                Back to pricing
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutSimulatePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-20 text-center font-mono text-xs uppercase tracking-[0.14em] text-[var(--ink-3)]">Loading…</div>}>
      <SimulateInner />
    </Suspense>
  );
}
