import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 按钮规范（phototype/UI设计方案.md §5.5）：
 * - 圆角 4px，朱砂仅给每屏一个主行动；次行动为青玉文字（quiet）
 * - md/lg 触控高度 ≥ 44px（WCAG）
 * - 统一 expo-out 落定缓动，hover 仅 1px 抬升
 */
type Variant = "primary" | "secondary" | "outline" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--cinnabar)] text-[var(--primary-foreground)] hover:bg-[var(--cinnabar-deep)] hover:-translate-y-px",
  secondary:
    "bg-[var(--jade)] text-[#f2f7f3] hover:opacity-90 hover:-translate-y-px",
  outline:
    "border border-[var(--line-strong)] bg-transparent text-[var(--ink)] hover:bg-[var(--ink)]/5",
  ghost: "bg-transparent text-[var(--ink-2)] hover:bg-[var(--ink)]/5",
  quiet: "bg-transparent px-0 text-[var(--jade)] hover:underline underline-offset-4",
  danger: "bg-[var(--danger)] text-[#fff7ea] hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-7 text-base",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-semibold",
        "transition-all duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        "focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        variant !== "quiet" && sizes[size],
        className,
      )}
      {...props}
    />
  );
});
