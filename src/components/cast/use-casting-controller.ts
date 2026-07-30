"use client";

import { useCallback, useEffect, useState } from "react";
import {
  completeYarrowAction,
  createCastingSessionAction,
  createMeiHuaResultAction,
  generateThreeCoinLineAction,
  generateYarrowChangeAction,
  getCastingSnapshotAction,
  revealCastingAction,
  startDeepReadingAction,
  startPreviewAction,
  submitQuestionAction,
} from "@/app/actions";
import {
  INTERPRETATION_GOALS,
  SCENES,
  type CastingMethod,
} from "@/domain/casting/types";
import type { CastingSnapshot } from "@/server/services/casting-snapshot-service";

const CASTING_ID_STORAGE_KEY = "iching_casting_id";
const ACTIVE_GENERATION_STATUSES = new Set(["queued", "generating", "reserved", "validating"]);

type ControllerState = {
  phase: "input" | "ritual" | "reveal" | "result" | "crisis" | "expired";
  castingId: string | null;
  scene: string;
  goal: string;
  context: string;
  riskStatus: string;
  completedSteps: number;
  totalSteps: number;
  result: CastingSnapshot["result"];
  previewStatus: string;
  previewText: string | null;
  readingStatus: string;
  readingReport: Record<string, unknown> | null;
  ianaTimeZone: string;
  error: string | null;
  pending: boolean;
};

const initialState: ControllerState = {
  phase: "input",
  castingId: null,
  scene: SCENES[0],
  goal: INTERPRETATION_GOALS[0],
  context: "",
  riskStatus: "",
  completedSteps: 0,
  totalSteps: 0,
  result: null,
  previewStatus: "not_started",
  previewText: null,
  readingStatus: "not_started",
  readingReport: null,
  ianaTimeZone: "America/New_York",
  error: null,
  pending: false,
};

function stateFromSnapshot(previous: ControllerState, snapshot: CastingSnapshot): ControllerState {
  return {
    ...previous,
    phase: snapshot.phase,
    castingId: snapshot.castingId,
    scene: snapshot.scene,
    goal: snapshot.interpretationGoal,
    riskStatus: snapshot.riskStatus,
    completedSteps: snapshot.progress.completedSteps,
    totalSteps: snapshot.progress.totalSteps,
    result: snapshot.result,
    previewStatus: snapshot.preview?.status ?? "not_started",
    previewText: snapshot.preview?.relevanceStatement ?? null,
    readingStatus: snapshot.reading?.status ?? "not_started",
    readingReport: snapshot.reading?.report ?? null,
    error: null,
    pending: false,
  };
}

function errorMessage(result: { ok: false; error: { message: string } }): string {
  return result.error.message;
}

export function useCastingController(method: CastingMethod) {
  const [state, setState] = useState<ControllerState>(initialState);

  const refresh = useCallback(async (castingId: string) => {
    const loaded = await getCastingSnapshotAction({ castingId });
    if (!loaded.ok || !loaded.value || loaded.value.method !== method) {
      sessionStorage.removeItem(CASTING_ID_STORAGE_KEY);
      setState((current) => ({ ...current, castingId: null, phase: "input", pending: false }));
      return;
    }
    setState((current) => stateFromSnapshot(current, loaded.value));
  }, [method]);

  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) setState((current) => ({ ...current, ianaTimeZone: timezone }));
    } catch { /* retain safe default */ }
    const castingId = sessionStorage.getItem(CASTING_ID_STORAGE_KEY);
    if (castingId) void refresh(castingId);
  }, [refresh]);

  useEffect(() => {
    if (!state.castingId) return;
    const active = ACTIVE_GENERATION_STATUSES.has(state.previewStatus)
      || ACTIVE_GENERATION_STATUSES.has(state.readingStatus);
    if (!active) return;
    const interval = window.setInterval(() => void refresh(state.castingId!), 2_000);
    return () => window.clearInterval(interval);
  }, [refresh, state.castingId, state.previewStatus, state.readingStatus]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setState((current) => ({ ...current, pending: true, error: null }));
    try { await operation(); }
    catch (error) {
      setState((current) => ({
        ...current,
        pending: false,
        error: error instanceof Error ? error.message : "The request could not be completed.",
      }));
    }
  }, []);

  async function submitQuestion() {
    await run(async () => {
      const created = await createCastingSessionAction({
        method,
        scene: state.scene,
        interpretationGoal: state.goal,
      });
      if (!created.ok) throw new Error(errorMessage(created));
      const castingId = created.value.castingId;
      const submitted = await submitQuestionAction({ castingId, context: state.context });
      if (!submitted.ok) throw new Error(errorMessage(submitted));
      sessionStorage.setItem(CASTING_ID_STORAGE_KEY, castingId);
      await refresh(castingId);
    });
  }

  async function castNext() {
    if (!state.castingId) return;
    await run(async () => {
      if (method === "three_coin") {
        const result = await generateThreeCoinLineAction({ castingId: state.castingId!, lineIndex: state.completedSteps });
        if (!result.ok) throw new Error(errorMessage(result));
      } else if (method === "yarrow_stalk") {
        const result = await generateYarrowChangeAction({
          castingId: state.castingId!,
          lineIndex: Math.floor(state.completedSteps / 3),
          changeIndex: state.completedSteps % 3,
        });
        if (!result.ok) throw new Error(errorMessage(result));
        if (state.completedSteps === 17) {
          const complete = await completeYarrowAction({ castingId: state.castingId! });
          if (!complete.ok) throw new Error(errorMessage(complete));
        }
      } else {
        const result = await createMeiHuaResultAction({
          castingId: state.castingId!, ianaTimeZone: state.ianaTimeZone,
        });
        if (!result.ok) throw new Error(errorMessage(result));
      }
      await refresh(state.castingId!);
    });
  }

  async function reveal(email: string) {
    if (!state.castingId) return;
    await run(async () => {
      const result = await revealCastingAction({ castingId: state.castingId!, email });
      if (!result.ok) throw new Error(errorMessage(result));
      if (result.value.duplicate) {
        sessionStorage.setItem(CASTING_ID_STORAGE_KEY, result.value.castingId);
        await refresh(result.value.castingId);
        return;
      }
      await refresh(state.castingId!);
    });
  }

  async function generatePreview() {
    if (!state.castingId) return;
    await run(async () => {
      const result = await startPreviewAction({ castingId: state.castingId! });
      if (!result.ok) throw new Error(errorMessage(result));
      await refresh(state.castingId!);
    });
  }

  async function generateReading() {
    if (!state.castingId) return;
    await run(async () => {
      const result = await startDeepReadingAction({ castingId: state.castingId! });
      if (!result.ok) throw new Error(errorMessage(result));
      await refresh(state.castingId!);
    });
  }

  return {
    state,
    setScene: (scene: string) => setState((current) => ({ ...current, scene })),
    setGoal: (goal: string) => setState((current) => ({ ...current, goal })),
    setContext: (context: string) => setState((current) => ({ ...current, context })),
    setTimeZone: (ianaTimeZone: string) => setState((current) => ({ ...current, ianaTimeZone })),
    submitQuestion,
    castNext,
    reveal,
    generatePreview,
    generateReading,
  };
}

export type CastingController = ReturnType<typeof useCastingController>;
