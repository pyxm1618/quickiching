import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const LINK = "text-[var(--ink-3)] transition-colors hover:text-[var(--gold-2)]";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/[0.08] bg-black/10">
      <div className="mx-auto grid max-w-[1240px] gap-9 px-5 py-14 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-3 font-semibold tracking-[0.02em]"><BrandMark size="md" />Quick I Ching</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--ink-3)]">A free I Ching online casting and reflection platform with Three-Coin, Yarrow Stalks, Mei Hua Yi Shu, and Manual Cast methods.</p>
        </div>
        <div>
          <p className="mystic-kicker">Casting</p>
          <ul className="mt-4 space-y-2 text-sm"><li><Link href="/methods/three-coin" className={LINK}>Three-Coin Method</Link></li><li><Link href="/methods/yarrow-stalks" className={LINK}>Yarrow Stalk Method</Link></li><li><Link href="/methods/mei-hua-yi-shu" className={LINK}>Mei Hua Yi Shu</Link></li><li><Link href="/methods/manual-cast" className={LINK}>Manual Cast</Link></li><li><Link href="/history" className={LINK}>Local History</Link></li><li><Link href="/hexagrams" className={LINK}>64 Hexagrams</Link></li></ul>
        </div>
        <div>
          <p className="mystic-kicker">Guides</p>
          <ul className="mt-4 space-y-2 text-sm"><li><Link href="/guides/how-to-ask-the-i-ching" className={LINK}>How to Ask</Link></li><li><Link href="/guides/changing-lines" className={LINK}>Changing Lines</Link></li><li><Link href="/guides/primary-relating-hexagrams" className={LINK}>Primary & Relating</Link></li></ul>
        </div>
        <div>
          <p className="mystic-kicker">Trust</p>
          <ul className="mt-4 space-y-2 text-sm"><li><Link href="/privacy" className={LINK}>Privacy</Link></li><li><Link href="/terms" className={LINK}>Terms</Link></li><li><Link href="/acceptable-use" className={LINK}>Acceptable Use</Link></li><li><Link href="/help" className={LINK}>Help & Support</Link></li></ul>
        </div>
      </div>
      <div className="border-t border-white/[0.07] px-5 py-6 text-center font-mono text-[11px] tracking-[0.04em] text-[var(--ink-3)]">© {new Date().getFullYear()} Quick I Ching · For reflection, not deterministic prediction or professional advice · support@quickiching.com</div>
    </footer>
  );
}
