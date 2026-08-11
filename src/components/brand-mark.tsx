import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-11 w-11",
};

export type BrandMarkProps = {
  size?: Size;
  className?: string;
};

export function BrandMark({ size = "md", className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center",
        SIZES[size],
        className,
      )}
    >
      <Image
        src="/quick-i-ching-logo-mark-inverse.png"
        alt="Quick I Ching logo"
        width={320}
        height={320}
        sizes="44px"
        className="block h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
