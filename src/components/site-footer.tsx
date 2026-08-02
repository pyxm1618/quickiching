import Link from "next/link";
import { SealMark } from "@/components/hex/seal-mark";

const LINK = "text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-[var(--paper-raised)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.4fr,1fr,1fr]">
        <div>
          <p className="flex items-center gap-2 font-display text-[15px] font-medium">
            <SealMark size="sm" />
            Quick I Ching
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-3)]">
            A structured I Ching reflection tool. The free browser-based coin-casting preview is available now; accounts, AI readings, and payments are temporarily disabled.
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Legal</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/privacy" className={LINK}>Privacy Policy</Link></li>
            <li><Link href="/terms" className={LINK}>Terms of Service</Link></li>
            <li><Link href="/acceptable-use" className={LINK}>Acceptable Use</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Contact</p>
          <p className="mt-3 text-sm text-[var(--ink-3)]">
            <a href="mailto:support@quickiching.com" className={LINK}>support@quickiching.com</a>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-3)]">Customer support and privacy requests are handled through this monitored address.</p>
        </div>
      </div>
      <div className="border-t border-[var(--line)] py-5 text-center font-mono text-[11px] tracking-[0.06em] text-[var(--ink-3)]">
        © {new Date().getFullYear()} Quick I Ching · For reflection, not professional advice
      </div>
    </footer>
  );
}
