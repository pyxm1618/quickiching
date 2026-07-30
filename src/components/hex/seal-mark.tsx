import { cn } from "@/lib/utils";

/**
 * 朱砂印 —— 品牌印记之一（phototype/UI设计方案.md §5.3）
 *
 * 仅用于「封存 / 固定 / 认证」三类时刻：结果已封存（封）、预览已固定（固）、
 * 品牌标识（易）。每屏最多一枚，保持稀缺性。
 */

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-6 w-6 text-xs",
  md: "h-7 w-7 text-sm",
  lg: "h-11 w-11 text-2xl",
};

export type SealMarkProps = {
  /** 印文单字，默认「易」。 */
  char?: string;
  size?: Size;
  /** 微转 −6°，模拟手盖感。 */
  tilt?: boolean;
  className?: string;
};

export function SealMark({ char = "易", size = "md", tilt = false, className }: SealMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-[3px]",
        "bg-[var(--cinnabar)] font-cjk leading-none text-[#fff7ea]",
        SIZES[size],
        tilt && "-rotate-6",
        className,
      )}
    >
      {char}
    </span>
  );
}
