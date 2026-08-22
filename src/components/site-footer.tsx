import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";

const LINK = "inline-flex min-h-11 items-center py-1 text-[var(--ink-3)] transition-colors hover:text-[var(--jade)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]";

export function SiteFooter({ locale = "en" }: { locale?: ContentLocale }) {
  const dictionary = getDictionary(locale);
  const isChinese = locale === "zh-Hans";

  if (isChinese) {
    return (
      <footer className="mt-20 border-t border-[var(--line)] bg-[var(--paper-raised)]">
        <div className="mx-auto grid max-w-[1240px] gap-9 px-5 py-14 sm:grid-cols-2 sm:px-7 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark size="md" />
              <span className="font-display font-medium text-base text-[var(--ink)]">周易 · 易经在线</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-[var(--ink-3)]">{dictionary.footer.description}</p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.footer.casting}</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/zh/methods/mei-hua-yi-shu" className={LINK}>{dictionary.footer.meiHua}</Link></li>
              <li><Link href="/zh/hexagrams" className={LINK}>{dictionary.footer.hexagrams}</Link></li>
              <li><Link href="/zh" className={LINK}>{dictionary.footer.home}</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.footer.trust}</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/privacy" className={LINK}>{dictionary.footer.privacy}</Link></li>
              <li><Link href="/terms" className={LINK}>{dictionary.footer.terms}</Link></li>
              <li><Link href="/acceptable-use" className={LINK}>{dictionary.footer.acceptableUse}</Link></li>
              <li><Link href="/help" className={LINK}>{dictionary.footer.help}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--line)] px-5 py-6 text-center font-mono text-[11px] tracking-[0.04em] text-[var(--ink-3)]">
          © {new Date().getFullYear()} Quick I Ching · {dictionary.footer.legalNotice} · {dictionary.footer.supportEmail}
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-[var(--paper-raised)]">
      <div className="mx-auto grid max-w-[1240px] gap-9 px-5 py-14 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark size="md" />
            <span className="font-display font-medium text-base text-[var(--ink)]">Book of Changes</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--ink-3)]">{dictionary.footer.description}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.footer.casting}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/methods/three-coin" className={LINK}>{dictionary.footer.threeCoin}</Link></li>
            <li><Link href="/methods/yarrow-stalks" className={LINK}>{dictionary.footer.yarrow}</Link></li>
            <li><Link href="/methods/mei-hua-yi-shu" className={LINK}>{dictionary.footer.meiHua}</Link></li>
            <li><Link href="/methods/manual-cast" className={LINK}>{dictionary.footer.manual}</Link></li>
            <li><Link href="/history" className={LINK}>{dictionary.footer.localHistory}</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.footer.guides}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/hexagrams" className={LINK}>{dictionary.footer.hexagrams}</Link></li>
            <li><Link href="/guides/how-to-ask-the-i-ching" className={LINK}>{dictionary.footer.howToAsk}</Link></li>
            <li><Link href="/guides/changing-lines" className={LINK}>{dictionary.footer.changingLines}</Link></li>
            <li><Link href="/guides/primary-relating-hexagrams" className={LINK}>{dictionary.footer.primaryRelating}</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.footer.trust}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/privacy" className={LINK}>{dictionary.footer.privacy}</Link></li>
            <li><Link href="/terms" className={LINK}>{dictionary.footer.terms}</Link></li>
            <li><Link href="/acceptable-use" className={LINK}>{dictionary.footer.acceptableUse}</Link></li>
            <li><Link href="/help" className={LINK}>{dictionary.footer.help}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--line)] px-5 py-6 text-center font-mono text-[11px] tracking-[0.04em] text-[var(--ink-3)]">
        © {new Date().getFullYear()} Quick I Ching · {dictionary.footer.legalNotice} · {dictionary.footer.supportEmail}
      </div>
    </footer>
  );
}
