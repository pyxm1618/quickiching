import { Card } from "@/components/ui/card";
import { HexagramLines, lineLabel } from "@/components/hex/hexagram-lines";
import { SealMark } from "@/components/hex/seal-mark";
import { hexagramByNumber, type Trigram } from "@/domain/casting/hexagrams/king-wen";

/**
 * 碑刻式结果卡（phototype/UI设计方案.md §6.3）：
 * 卦画以最大规格立于左侧如碑刻；右侧卦名 + 汉字注脚 + 上下卦构成；
 * 「封」印表示结果已封存，不再变更。
 */

type Props = {
  lineValues: number[]; // bottom-up (index 0 = line 1)
  primaryName: string;
  primaryNumber: number;
  movingLinePositions: number[];
  relatingName: string | null;
  relatingNumber: number | null;
  algorithmVersion: string;
  classicMappingVersion: string;
};

const TRIGRAM_META: Record<Trigram, { symbol: string; en: string; zh: string }> = {
  qian: { symbol: "☰", en: "Heaven", zh: "天" },
  dui: { symbol: "☱", en: "Lake", zh: "泽" },
  li: { symbol: "☲", en: "Fire", zh: "火" },
  zhen: { symbol: "☳", en: "Thunder", zh: "雷" },
  xun: { symbol: "☴", en: "Wind", zh: "风" },
  kan: { symbol: "☵", en: "Water", zh: "水" },
  gen: { symbol: "☶", en: "Mountain", zh: "山" },
  kun: { symbol: "☷", en: "Earth", zh: "地" },
};

const COUNT_WORDS = ["NO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"] as const;

/** 由本卦与动爻推导变卦六爻（纯展示推导：老阳 9→阴 8，老阴 6→阳 7）。 */
function relatingLines(lineValues: number[]): number[] {
  return lineValues.map((v) => (v === 9 ? 8 : v === 6 ? 7 : v));
}

export function HexagramDisplay(props: Props) {
  const def = hexagramByNumber(props.primaryNumber);
  const upper = TRIGRAM_META[def.upper];
  const lower = TRIGRAM_META[def.lower];
  const moving = props.movingLinePositions;
  const relatingDef = props.relatingNumber ? hexagramByNumber(props.relatingNumber) : null;

  const verdict =
    moving.length === 0
      ? "NO MOVING LINES · READ AS STABLE · 静卦"
      : `${COUNT_WORDS[moving.length]} MOVING LINE${moving.length > 1 ? "S" : ""} · ${moving
          .map((p) => lineLabel(p, props.lineValues[p - 1]))
          .join(" · ")}`;

  return (
    <Card className="relative">
      <div className="absolute right-5 top-5">
        <SealMark char="封" size="sm" tilt />
      </div>

      <div className="grid gap-8 p-7 sm:p-9 md:grid-cols-[210px,1fr]">
        {/* 左：碑刻卦画 */}
        <div>
          <HexagramLines lines={props.lineValues} size="lg" showLabels />
          <p className="mt-5 font-mono text-[11px] tracking-[0.08em] text-[var(--ink-3)]">{verdict}</p>
        </div>

        {/* 右：卦名与构成 */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">
            Hexagram No. {props.primaryNumber}
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
            {props.primaryName}
            <span className="ml-3 font-cjk text-[0.85em] text-[var(--cinnabar)]">{def.chineseName}</span>
          </h2>
          <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">
            {upper.symbol} OVER {lower.symbol} · {upper.en} above, {lower.en} below ·{" "}
            <span className="font-cjk">
              {upper.zh}
              {lower.zh}
              {def.chineseName}
            </span>
          </p>
          <p className="mt-5 text-sm leading-relaxed text-[var(--ink-2)]">
            Cast with the {props.algorithmVersion.replace(/-/g, " ")} ruleset. Six lines sealed from
            bottom to top; the pattern below is fixed for this cast.
          </p>
          <p className="mt-4 font-mono text-[11px] text-[var(--ink-3)]">
            {props.algorithmVersion} · {props.classicMappingVersion} · licensed classic text import
            pending (G-02)
          </p>
        </div>
      </div>

      {/* 变卦条 */}
      <div className="flex items-center justify-center gap-3 border-t border-[var(--line)] px-7 py-4 text-sm text-[var(--ink-2)]">
        {props.relatingNumber && relatingDef ? (
          <>
            <span>Changing toward</span>
            <HexagramLines lines={relatingLines(props.lineValues)} size="sm" className="w-9 shrink-0" />
            <span>
              <strong className="font-display font-medium">
                {props.relatingNumber} · {props.relatingName}
              </strong>{" "}
              <span className="font-cjk text-[var(--cinnabar)]">{relatingDef.chineseName}</span>
            </span>
          </>
        ) : (
          <span className="text-[var(--ink-3)]">
            No moving lines — the hexagram is read as stable (no relating hexagram).
          </span>
        )}
      </div>
    </Card>
  );
}
