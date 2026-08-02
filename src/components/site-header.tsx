import Link from "next/link";
import { SealMark } from "@/components/hex/seal-mark";

const NAV_LINK =
  "text-[13.5px] text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-[17px] font-medium text-[var(--ink)]"
        >
          <SealMark size="sm" />
          <span>Quick I Ching</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2" aria-label="Primary navigation">
          <Link href="/#how-it-works" className={NAV_LINK}>How it works</Link>
          <Link href="/pricing" className={NAV_LINK}>Pricing</Link>
          <Link href="/privacy" className={NAV_LINK}>Privacy</Link>
          <Link href="/terms" className={NAV_LINK}>Terms</Link>
          <span className="rounded-full border border-[var(--line-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bronze)]">
            Public preview
          </span>
        </nav>
      </div>
    </header>
  );
}
