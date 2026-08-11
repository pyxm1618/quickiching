import { cn } from "@/lib/utils";

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

export function lineLabel(position: number, value: number): string {
  const yang = value === 7 || value === 9;
  return (yang ? YANG_LABELS : YIN_LABELS)[position - 1] ?? "";
}

export function movingMark(value: number): "○" | "×" | null {
  if (value === 9) return "○";
  if (value === 6) return "×";
  return null;
}

function YinYangBar({ value, size }: { value: number; size: Size }) {
  const yang = value === 7 || value === 9;
  const moving = value === 6 || value === 9;
  const bar = cn(
    BAR_HEIGHT[size],
    "rounded-full transition-[filter,box-shadow]",
    moving
      ? "bg-[var(--cyan)] shadow-[0_0_18px_rgba(137,233,227,.28)]"
      : "bg-gradient-to-r from-[#ad9259] to-[var(--gold-2)] shadow-[0_0_14px_rgba(232,198,122,.12)]",
  );

  if (yang) return <div className={cn(bar, "w-full")} />;

  return (
    <div className="flex w-full items-center">
      <div className={cn(bar, "flex-1")} />
      <div className="w-[12%] shrink-0" />
      <div className={cn(bar, "flex-1")} />
    </div>
  );
}

export type HexagramLinesProps = {
  lines: number[];
  size?: Size;
  showLabels?: boolean;
  sealedCount?: number;
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
  const positions = Array.from({ length: total }, (_, i) => total - i);

  return (
    <div className={cn("flex flex-col", size === "lg" ? "gap-3" : size === "md" ? "gap-2.5" : "gap-1.5", className)}>
      {positions.map((pos) => {
        const value = lines[pos - 1];
        const sealed = ritual ? pos <= (sealedCount ?? 0) : value !== undefined;
        const mark = sealed && value !== undefined ? movingMark(value) : null;
        const isLastSealed = ritual && animateLast && pos === sealedCount;
        const label = sealed && value !== undefined ? lineLabel(pos, value) : ritual ? ORDINALS[pos - 1] : "";
        const english = sealed && value !== undefined
          ? `Line ${pos}: ${value === 7 || value === 9 ? "yang" : "yin"}${mark ? ", moving" : ""}`
          : `Line ${pos}: not yet cast`;

        return (
          <div key={pos} className={cn("flex items-center gap-3", sealed ? "opacity-100" : "opacity-35")} role="img" aria-label={english}>
            {showLabels && (
              <span
                className={cn(
                  "shrink-0 font-cjk text-right tracking-wide",
                  size === "lg" ? "w-9 text-sm" : "w-7 text-xs",
                  sealed ? "text-[var(--ink-3)]" : "text-[var(--ink-3)]",
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
                <div className="flex h-full items-center py-1">
                  <div className="h-px w-full bg-white/[0.12]" />
                </div>
              )}
            </div>
            <span
              aria-hidden={!mark}
              className={cn(
                "shrink-0 text-center leading-none text-[var(--cyan)] [text-shadow:0_0_12px_rgba(137,233,227,.5)]",
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
