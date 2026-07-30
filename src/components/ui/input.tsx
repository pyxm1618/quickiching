import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 表单规范（phototype/UI设计方案.md §5.5）：
 * 4px 圆角、44px 触控高度、裱纸底（暗室自动切色）、朱砂焦点环；
 * Label 采用 mono 大写 caption（§3：大写只留给 mono caption）。
 */

const fieldClass =
  "w-full rounded border border-[var(--line)] bg-[var(--paper-raised)] px-4 text-sm text-[var(--ink)] " +
  "placeholder:text-[var(--ink-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cinnabar)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--paper)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldClass, "h-11", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldClass, "py-3", className)} {...props} />;
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] bg-[var(--jade-wash)] px-2.5 py-1",
        "font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--jade)]",
        className,
      )}
      {...props}
    />
  );
}
