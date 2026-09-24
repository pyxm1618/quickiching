import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date, locale: "en" | "zh-Hans" | string = "en-US"): string {
  const intlLocale = locale === "zh-Hans" ? "zh-CN" : locale;
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(d);
}
