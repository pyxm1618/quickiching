import { cn } from "@/lib/utils";

/**
 * 方孔钱 —— 品牌印记之一（phototype/UI设计方案.md §5.2）
 *
 * 圆环古铜渐变 + 中央方孔。字面（head = 3）示「乾」字，背素面（tail = 2）。
 */

export type CoinMarkProps = {
  /** 直径（px）。 */
  size?: number;
  /** 朝上的一面；null 表示未掷/背面素钱。 */
  face?: "head" | "tail" | null;
  /** 播放松 600ms 落定动画。 */
  settle?: boolean;
  className?: string;
};

export function CoinMark({ size = 44, face = null, settle = false, className }: CoinMarkProps) {
  const hole = Math.max(4, Math.round(size * 0.26));
  return (
    <span
      role="img"
      aria-label={face === "head" ? "coin showing characters (3)" : face === "tail" ? "coin showing plain side (2)" : "coin"}
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", settle && "coin-settle", className)}
      style={{
        width: size,
        height: size,
        border: `${Math.max(1.5, size * 0.055)}px solid var(--bronze)`,
        background: "radial-gradient(circle at 32% 28%, var(--bronze-bright), var(--bronze) 78%)",
      }}
    >
      {face === "head" && (
        <span
          aria-hidden
          className="font-cjk absolute left-1/2 -translate-x-1/2 leading-none text-[var(--paper)]"
          style={{ top: size * 0.1, fontSize: size * 0.22, opacity: 0.9 }}
        >
          乾
        </span>
      )}
      <span
        aria-hidden
        style={{
          width: hole,
          height: hole,
          background: "var(--paper)",
          border: `${Math.max(1, size * 0.035)}px solid var(--bronze)`,
        }}
      />
    </span>
  );
}
