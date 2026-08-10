import Link from "next/link";
import { SealMark } from "@/components/hex/seal-mark";

const NAV_LINK = "text-[13.5px] text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 font-display text-[17px] font-medium text-[var(--ink)]">
          <SealMark size="sm" />
          <span>Quick I Ching</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1" aria-label="Primary navigation">
          <Link href="/#three-coin-reading" className={NAV_LINK}>Read online</Link>
          <Link href="/methods/yarrow-stalks" className={NAV_LINK}>Yarrow</Link>
          <Link href="/methods/mei-hua-yi-shu" className={NAV_LINK}>Mei Hua</Link>
          <Link href="/hexagrams" className={NAV_LINK}>Hexagrams</Link>
          <Link href="/guides/how-to-ask-the-i-ching" className={NAV_LINK}>Guides</Link>
        </nav>
      </div>
    </header>
  );
}
