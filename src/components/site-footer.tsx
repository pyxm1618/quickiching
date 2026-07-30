import Link from "next/link";
import { SealMark } from "@/components/hex/seal-mark";

const HEADING = "font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]";
const LINK = "text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-[var(--paper-raised)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-display text-[15px] font-medium">
            <SealMark size="sm" />
            I Ching Coin
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-3)]">
            Understand where you are, how it may be changing, and what to watch before you act.
          </p>
        </div>
        <div>
          <p className={HEADING}>Methods</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/three-coin-method" className={LINK}>Three-Coin</Link></li>
            <li><Link href="/yarrow-stalk-method" className={LINK}>Yarrow Stalk</Link></li>
            <li><Link href="/mei-hua-yi-shu" className={LINK}>Mei Hua</Link></li>
            <li><Link href="/casting-methods" className={LINK}>All Methods</Link></li>
          </ul>
        </div>
        <div>
          <p className={HEADING}>Learn</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/how-to-ask-the-i-ching" className={LINK}>How to Ask</Link></li>
            <li><Link href="/changing-lines" className={LINK}>Changing Lines</Link></li>
            <li><Link href="/primary-and-relating-hexagrams" className={LINK}>Hexagrams</Link></li>
            <li><Link href="/pricing" className={LINK}>Pricing</Link></li>
          </ul>
        </div>
        <div>
          <p className={HEADING}>Legal</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/privacy" className={LINK}>Privacy</Link></li>
            <li><Link href="/terms" className={LINK}>Terms</Link></li>
            <li><Link href="/acceptable-use" className={LINK}>Acceptable Use</Link></li>
            <li><Link href="/help" className={LINK}>Help</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--line)] py-6 text-center font-mono text-[11px] tracking-[0.06em] text-[var(--ink-3)]">
        © {new Date().getFullYear()} I Ching Coin · For reflection, not professional advice
      </div>
    </footer>
  );
}
