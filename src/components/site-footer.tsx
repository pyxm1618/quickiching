import Link from "next/link";
import { SealMark } from "@/components/hex/seal-mark";

const LINK = "text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-[var(--paper-raised)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-display text-[15px] font-medium"><SealMark size="sm" />Quick I Ching</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-3)]">A free I Ching online casting and reflection platform with Three Coin, Yarrow Stalk, and Mei Hua Yi Shu current-time methods.</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Casting</p>
          <ul className="mt-3 space-y-1.5 text-sm"><li><Link href="/methods/three-coin" className={LINK}>Three-Coin Method</Link></li><li><Link href="/methods/yarrow-stalks" className={LINK}>Yarrow Stalk Method</Link></li><li><Link href="/methods/mei-hua-yi-shu" className={LINK}>Mei Hua Yi Shu</Link></li><li><Link href="/hexagrams" className={LINK}>64 Hexagrams</Link></li></ul>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Guides</p>
          <ul className="mt-3 space-y-1.5 text-sm"><li><Link href="/guides/how-to-ask-the-i-ching" className={LINK}>How to Ask</Link></li><li><Link href="/guides/changing-lines" className={LINK}>Changing Lines</Link></li><li><Link href="/guides/primary-relating-hexagrams" className={LINK}>Primary & Relating</Link></li></ul>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Trust</p>
          <ul className="mt-3 space-y-1.5 text-sm"><li><Link href="/privacy" className={LINK}>Privacy</Link></li><li><Link href="/terms" className={LINK}>Terms</Link></li><li><Link href="/acceptable-use" className={LINK}>Acceptable Use</Link></li><li><Link href="/help" className={LINK}>Help & Support</Link></li></ul>
        </div>
      </div>
      <div className="border-t border-[var(--line)] px-4 py-5 text-center font-mono text-[11px] tracking-[0.04em] text-[var(--ink-3)]">© {new Date().getFullYear()} Quick I Ching · For reflection, not deterministic prediction or professional advice · support@quickiching.com</div>
    </footer>
  );
}
