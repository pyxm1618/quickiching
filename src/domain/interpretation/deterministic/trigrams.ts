import type { Trigram } from "@/domain/casting/hexagrams/king-wen";

// Five-phase and image attributes of the eight trigrams. These are the fixed
// classical correspondences every later rule depends on, so they live in one
// table rather than being restated per rule.
export type FivePhase = "metal" | "wood" | "water" | "fire" | "earth";

// Language-neutral attributes only. 卦德 and 卦象 are presentation and live in
// localize.ts; chineseName and symbol are the trigram's own identity, not a
// translation of it.
export type TrigramAttributes = {
  trigram: Trigram;
  chineseName: string;
  symbol: string;
  phase: FivePhase;
};

export const TRIGRAM_ATTRIBUTES: Readonly<Record<Trigram, TrigramAttributes>> = Object.freeze({
  qian: { trigram: "qian", chineseName: "乾", symbol: "☰", phase: "metal" },
  dui: { trigram: "dui", chineseName: "兑", symbol: "☱", phase: "metal" },
  li: { trigram: "li", chineseName: "离", symbol: "☲", phase: "fire" },
  zhen: { trigram: "zhen", chineseName: "震", symbol: "☳", phase: "wood" },
  xun: { trigram: "xun", chineseName: "巽", symbol: "☴", phase: "wood" },
  kan: { trigram: "kan", chineseName: "坎", symbol: "☵", phase: "water" },
  gen: { trigram: "gen", chineseName: "艮", symbol: "☶", phase: "earth" },
  kun: { trigram: "kun", chineseName: "坤", symbol: "☷", phase: "earth" },
});

// 五行相生: wood -> fire -> earth -> metal -> water -> wood
const GENERATES: Readonly<Record<FivePhase, FivePhase>> = Object.freeze({
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
});

// 五行相克: wood -> earth -> water -> fire -> metal -> wood
const OVERCOMES: Readonly<Record<FivePhase, FivePhase>> = Object.freeze({
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood",
});

export function generates(source: FivePhase, target: FivePhase): boolean {
  return GENERATES[source] === target;
}

export function overcomes(source: FivePhase, target: FivePhase): boolean {
  return OVERCOMES[source] === target;
}

export function trigramPhase(trigram: Trigram): FivePhase {
  return TRIGRAM_ATTRIBUTES[trigram].phase;
}
