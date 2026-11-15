"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { NavigationFlowState, ThreeCoinStage } from "./surface-contract";

/**
 * Live flow state shared by surfaces and the navigation shell.
 *
 * A surface declares the state it is in; the shell resolves the Surface
 * Contract. No surface may hide, replace or re-implement shell navigation —
 * it may only state which of its own declared surfaces is active.
 */
type NavigationSurfaceValue = {
  flowState: NavigationFlowState;
  setThreeCoinStage: (stage: ThreeCoinStage | undefined) => void;
  setPricingReadingContext: (active: boolean) => void;
};

const NOOP = () => {};

const NavigationSurfaceContext = createContext<NavigationSurfaceValue | null>(null);

const DETACHED: NavigationSurfaceValue = {
  flowState: {},
  setThreeCoinStage: NOOP,
  setPricingReadingContext: NOOP,
};

export function NavigationSurfaceProvider({
  children,
  initialFlowState,
}: {
  children: React.ReactNode;
  initialFlowState?: NavigationFlowState;
}) {
  const [threeCoinStage, setThreeCoinStage] = useState<ThreeCoinStage | undefined>(initialFlowState?.threeCoinStage);
  const [pricingReadingContext, setPricingReadingContext] = useState(Boolean(initialFlowState?.pricingReadingContext));

  const value = useMemo<NavigationSurfaceValue>(() => ({
    flowState: {
      ...(threeCoinStage ? { threeCoinStage } : {}),
      ...(pricingReadingContext ? { pricingReadingContext: true } : {}),
    },
    setThreeCoinStage,
    setPricingReadingContext,
  }), [pricingReadingContext, threeCoinStage]);

  return <NavigationSurfaceContext.Provider value={value}>{children}</NavigationSurfaceContext.Provider>;
}

function useSurfaceValue(): NavigationSurfaceValue {
  return useContext(NavigationSurfaceContext) ?? DETACHED;
}

export function useNavigationFlowState(): NavigationFlowState {
  return useSurfaceValue().flowState;
}

/** Declares the live Three Coin stage on the root route (S01 vs S02). */
export function useDeclareThreeCoinStage(stage: ThreeCoinStage | undefined): void {
  const { setThreeCoinStage } = useSurfaceValue();
  useEffect(() => {
    setThreeCoinStage(stage);
  }, [setThreeCoinStage, stage]);
  useEffect(() => () => setThreeCoinStage(undefined), [setThreeCoinStage]);
}

/** Declares whether /pricing currently carries a validated reading return (S16). */
export function useDeclarePricingReadingContext(active: boolean): void {
  const { setPricingReadingContext } = useSurfaceValue();
  useEffect(() => {
    setPricingReadingContext(active);
  }, [active, setPricingReadingContext]);
  useEffect(() => () => setPricingReadingContext(false), [setPricingReadingContext]);
}
