import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-11 w-11 text-base",
};

export type SealMarkProps = {
  char?: string;
  size?: Size;
  tilt?: boolean;
  className?: string;
};

export function SealMark({ char = "易", size = "md", tilt = false, className }: SealMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-full border border-[rgba(232,198,122,.45)]",
        "bg-[rgba(232,198,122,.055)] font-cjk leading-none text-[var(--gold-2)] shadow-[0_0_30px_rgba(232,198,122,.12)]",
        "after:absolute after:inset-[5px] after:rounded-full after:border after:border-white/[0.07]",
        SIZES[size],
        tilt && "-rotate-6",
        className,
      )}
    >
      {char}
    </span>
  );
}
