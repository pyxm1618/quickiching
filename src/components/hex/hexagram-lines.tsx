import { cn } from "@/lib/utils";

/**
 * 卦画 —— 「明室 · 暗室」设计语言的唯一图形母题（phototype/UI设计方案.md §5.1）
 *
 * 阳爻整段（———），阴爻两分（—— ——，中段留 12% 缺口）；
 * 动爻（6 老阴 / 9 老阳）染朱砂，尾端以 ○（老阳）／×（老阴）标记。
 * 六爻自下而上构建、自上而下展示。
 */

type Size = "sm" | "md" | "lg";

const YANG_LABELS = ["初九", "九二", "九三", "九四", "九五", "上九"] as const;
const YIN_LABELS = ["初六", "六二", "六三", "六四", "六五", "上六"] as const;
const ORDINALS = ["初", "二", "三", "四", "五", "上"] as const;

const BAR_HEIGHT: Record<Size, string> = {
  sm: "h-1",
  md: "h-2.5",
  lg: "h-3",
};

const MARK_SIZE: Record<Size, string> = {
  sm: "text-[8px] w-3",
  md: "text-[11px] w-4",
  lg: "text-[13px] w-5",
};

/** 爻题：position 自下而上 1–6；value 6/7/8/9。 */
export function lineLabel(position: number, value: number): string {
  const yang = value === 7 || value === 9;
  return (yang ? YANG_LABELS : YIN_LABELS)[position - 1] ?? "";
}

/** 动爻标记：老阳 ○，老阴 ×；非动爻返回 null。 */
export function movingMark(value: number): "○" | "×" | null {
  if (value === 9) return "○";
  if (value === 6) return "×";
  return null;
}

function YinYangBar({ value, size }: { value: number; size: Size }) {
  const yang = value === 7 || value === 9;
  const moving = value === 6 || value === 9;
  const bar = cn(BAR_HEIGHT[size], "rounded-[1px]", moving ? "bg-[var(--cinnabar)]" : "bg-[var(--ink)]");
  if (yang) {
    return <div className={cn(bar, "w-full")} />;
  }
  return (
    <div className="flex w-full items-center">
      <div className={cn(bar, "flex-1")} />
      <div className="w-[12%] shrink-0" />
      <div className={cn(bar, "flex-1")} />
    </div>
  );
}

export type HexagramLinesProps = {
  /** 六爻数值，自下而上（index 0 = 初爻），取 6/7/8/9。 */
  lines: number[];
  size?: Size;
  /** 显示爻题（初九 / 六二 …）。 */
  showLabels?: boolean;
  /**
   * 仪式模式：仅前 sealedCount 爻（自下而上）已封存实线展示，
   * 其余爻位以虚线导轨预显「尚未成爻」。
   */
  sealedCount?: number;
  /** 为最后一条封存爻播放松 480ms 落定动画。 */
  animateLast?: boolean;
  className?: string;
};

export function HexagramLines({
  lines,
  size = "md",
  showLabels = false,
  sealedCount,
  animateLast = false,
  className,
}: HexagramLinesProps) {
  const total = 6;
  const ritual = sealedCount !== undefined;
  // 自上而下渲染：上爻（6）在前，初爻（1）在后。
  const positions = Array.from({ length: total }, (_, i) => total - i); // [6,5,4,3,2,1]

  return (
    <div className={cn("flex flex-col", size === "lg" ? "gap-2.5" : size === "md" ? "gap-2" : "gap-1", className)}>
      {positions.map((pos) => {
        const value = lines[pos - 1];
        const sealed = ritual ? pos <= (sealedCount ?? 0) : value !== undefined;
        const mark = sealed && value !== undefined ? movingMark(value) : null;
        const isLastSealed = ritual && animateLast && pos === sealedCount;
        const label =
          sealed && value !== undefined ? lineLabel(pos, value) : ritual ? ORDINALS[pos - 1] : "";
        const english =
          sealed && value !== undefined
            ? `Line ${pos}: ${value === 7 || value === 9 ? "yang" : "yin"}${mark ? ", moving" : ""}`
            : `Line ${pos}: not yet cast`;

        return (
          <div key={pos} className="flex items-center gap-3" role="img" aria-label={english}>
            {showLabels && (
              <span
                className={cn(
                  "shrink-0 font-cjk text-right",
                  size === "lg" ? "w-9 text-sm" : "w-7 text-xs",
                  sealed ? "text-[var(--ink-3)]" : "text-[var(--line-strong)]",
                )}
              >
                {label}
              </span>
            )}
            <div className="flex-1">
              {sealed && value !== undefined ? (
                <div className={isLastSealed ? "hex-line-draw" : undefined}>
                  <YinYangBar value={value} size={size} />
                </div>
              ) : (
                /* 未成爻导轨：1.5px 虚位线 */
                <div className="flex h-full items-center">
                  <div className="h-[1.5px] w-full bg-[var(--line)]" />
                </div>
              )}
            </div>
            <span
              aria-hidden={!mark}
              className={cn(
                "shrink-0 text-center leading-none text-[var(--cinnabar)]",
                MARK_SIZE[size],
              )}
            >
              {mark ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
