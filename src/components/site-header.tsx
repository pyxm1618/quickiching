import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const NAV_LINK = "relative min-h-10 inline-flex items-center text-[13px] text-[var(--ink-2)] transition-colors hover:text-white after:absolute after:bottom-1 after:left-0 after:h-px after:w-0 after:bg-[var(--gold)] after:transition-all hover:after:w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#09070f]/70 backdrop-blur-[18px]">
      <div className="mx-auto flex min-h-[74px] max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 sm:px-7">
        <Link href="/" className="flex min-h-11 items-center gap-3 font-semibold tracking-[0.02em] text-[var(--ink)]">
          <BrandMark size="md" />
          <span>Quick I Ching</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-0 sm:gap-x-6" aria-label="Primary navigation">
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
