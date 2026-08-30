"use client";

import { useEffect, useRef, useState } from "react";
import {
  ORDER_POLL_TIMEOUT_MS,
  nextPollDelayMs,
  probeOrder,
  type OrderProbe,
} from "./order-poll";

export type OrderWaitPhase =
  | "idle"
  | "waiting"
  | "paid"
  | "timed_out"
  | "refunded"
  | "review"
  | "not_found"
  | "signed_out";

export type OrderWait = {
  phase: OrderWaitPhase;
  /** Milliseconds since the wait began, for an honest "still working" display. */
  elapsedMs: number;
};

/**
 * Polls one order until it is paid, reaches another terminal state, or the
 * deadline passes. Backs off between attempts and stops entirely while the tab
 * is hidden — a backgrounded tab has nobody to show the answer to, and the
 * webhook does not need our attention to land.
 *
 * A transient failure is not terminal: the loop keeps trying until the
 * deadline, then reports timed_out, which callers must present as "still
 * processing" rather than as a failed payment.
 */
export function useOrderWait(orderId: string | null): OrderWait {
  const [phase, setPhase] = useState<OrderWaitPhase>(orderId ? "waiting" : "idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!orderId) {
      setPhase("idle");
      return;
    }

    setPhase("waiting");
    setElapsedMs(0);
    startedAtRef.current = Date.now();

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let releaseVisibility: (() => void) | undefined;
    const controller = new AbortController();

    const tick = setInterval(() => {
      if (!cancelled) setElapsedMs(Date.now() - startedAtRef.current);
    }, 1_000);

    const sleep = (ms: number) => new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    });

    const whileVisible = () => new Promise<void>((resolve) => {
      if (typeof document === "undefined" || !document.hidden) {
        resolve();
        return;
      }
      const onChange = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", onChange);
        releaseVisibility = undefined;
        resolve();
      };
      document.addEventListener("visibilitychange", onChange);
      releaseVisibility = () => {
        document.removeEventListener("visibilitychange", onChange);
        resolve();
      };
    });

    const settle = (probe: OrderProbe): OrderWaitPhase | null => {
      switch (probe.kind) {
        case "paid": return "paid";
        case "refunded": return "refunded";
        case "review": return "review";
        case "unauthorized": return "signed_out";
        // A missing order right after checkout is far more likely to be storage
        // pointing at something this reader does not own than a real answer, but
        // there is nothing further to poll for either way.
        case "not_found": return "not_found";
        // Pending and transient failures both mean: ask again later.
        default: return null;
      }
    };

    void (async () => {
      for (let attempt = 1; !cancelled; attempt += 1) {
        await whileVisible();
        if (cancelled) return;

        const settled = settle(await probeOrder(orderId, controller.signal));
        if (cancelled) return;
        if (settled) {
          setPhase(settled);
          return;
        }

        if (Date.now() - startedAtRef.current > ORDER_POLL_TIMEOUT_MS) {
          setPhase("timed_out");
          return;
        }
        await sleep(nextPollDelayMs(attempt));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(tick);
      if (timer) clearTimeout(timer);
      releaseVisibility?.();
    };
  }, [orderId]);

  return { phase, elapsedMs };
}
