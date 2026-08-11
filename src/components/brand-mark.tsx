import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const PIXELS: Record<Size, number> = {
  sm: 28,
  md: 32,
  lg: 44,
};

export type BrandMarkProps = {
  size?: Size;
  priority?: boolean;
  className?: string;
};

export function BrandMark({ size = "md", priority = false, className }: BrandMarkProps) {
  const pixels = PIXELS[size];

  return (
    <Image
      alt="Quick I Ching logo"
      src="/quick-i-ching-logo-mark.png"
      width={pixels}
      height={pixels}
      priority={priority}
      className={cn("shrink-0 object-contain brightness-0 invert", className)}
    />
  );
}
