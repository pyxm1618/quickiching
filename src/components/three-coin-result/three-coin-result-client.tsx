"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { buildFreeReading } from "@/domain/interpretation/v2/build-free-reading";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { FreeReading } from "@/domain/interpretation/v2/types";
import {
  clearThreeCoinReading,
  completedThreeCoinSteps,
  readThreeCoinSteps,
} from "@/lib/three-coin-session";
import { ReadingResultView } from "./reading-result-view";
import styles from "./result-page.module.css";

type ResultState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; reading: FreeReading }
  | { kind: "error"; code: string };

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "THREE_COIN_READING_UNAVAILABLE";
}

async function restoreCompletedReading(): Promise<ResultState> {
  const storedSteps = readThreeCoinSteps();
  const completedSteps = completedThreeCoinSteps(storedSteps);
  if (!completedSteps) return { kind: "empty" };

  const result = buildHexagramResult({
    lineValuesBottomUp: completedSteps.map((step) => step.lineValue),
    method: "three_coin",
  });
  const [primaryBundle, relatingBundle] = await Promise.all([
    loadHexagramInterpretation(result.primaryHexagramNumber),
    result.relatingHexagramNumber === null
      ? Promise.resolve(null)
      : loadHexagramInterpretation(result.relatingHexagramNumber),
  ]);
  return { kind: "ready", reading: buildFreeReading(result, primaryBundle, relatingBundle) };
}

export function ThreeCoinResultClient() {
  const [state, setState] = useState<ResultState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void restoreCompletedReading()
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: "error", code: errorCode(error) });
      });
    return () => {
      active = false;
    };
  }, []);

  function startNewReading() {
    clearThreeCoinReading();
    window.location.assign("/#three-coin-reading");
  }

  if (state.kind === "loading") {
    return (
      <div className={`${styles.page} mx-auto min-h-[100svh] w-full max-w-[1180px] px-4 sm:px-6`}>
        <div className={styles.loadingState} role="status" aria-label="Loading your completed reading">
          <p className="mystic-kicker">Three-Coin Method</p>
          <p className="mt-3 font-display text-3xl font-normal text-white">Restoring your sealed reading…</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">The result is rebuilt from the six completed lines stored in this browser session.</p>
        </div>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 sm:px-6`}>
        <section className={styles.emptyState} aria-labelledby="empty-reading-title">
          <p className="mystic-kicker">Three-Coin Result</p>
          <h1 id="empty-reading-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">No completed reading found</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)] sm:text-base">Complete a six-line Three-Coin reading before opening a result.</p>
          <Link href="/#three-coin-reading" className={`${styles.newReadingButton} mt-7`}>Start a Three-Coin Reading</Link>
        </section>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 sm:px-6`}>
        <section className={styles.emptyState} aria-labelledby="reading-error-title">
          <p className="mystic-kicker">Reading unavailable</p>
          <h1 id="reading-error-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">The sealed reading could not be interpreted</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)]">The stored cast was not replaced or randomized. Error: <code className="font-mono text-[var(--cyan)]">{state.code}</code></p>
          <Link href="/#three-coin-reading" className={`${styles.newReadingButton} mt-7`}>Return to Three-Coin Reading</Link>
        </section>
      </div>
    );
  }

  return <ReadingResultView reading={state.reading} onStartNewReading={startNewReading} />;
}
