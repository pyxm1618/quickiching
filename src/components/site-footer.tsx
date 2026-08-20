import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";

const LINK = "text-[var(--ink-3)] transition-colors hover:text-[var(--gold-2)]";

export function SiteFooter({ locale = "en" }: { locale?: ContentLocale }) {
  const dictionary = getDictionary(locale);
  if (locale === "zh-Hans") {
    return (
      <footer className="mt-20 border-t border-white/[0.08] bg-black/10">
        <div className="mx-auto grid max-w-[1240px] gap-9 px-5 py-14 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-3 font-semibold tracking-[0.02em]"><BrandMark size="md" />Quick I Ching</p>
            <p className="mt-4 max-w-md text-sm leading-7 text-[var(--ink-3)]">{dictionary.footer.description}</p>
          </div>
          <div>
            <p className="mystic-kicker">{dictionary.footer.casting}</p>
            <ul className="mt-4 space-y-2 text-sm"><li><Link href="/zh/methods/mei-hua-yi-shu" className={LINK}>{dictionary.footer.meiHua}</Link></li><li><Link href="/" className={LINK}>{dictionary.nav.englishSite}</Link></li></ul>
          </div>
          <div>
            <p className="mystic-kicker">{dictionary.footer.guides}</p>
            <ul className="mt-4 space-y-2 text-sm"><li><Link href="/methods/mei-hua-yi-shu" className={LINK}>{dictionary.footer.meiHua}（English）</Link></li><li><Link href="/guides/changing-lines" className={LINK}>{dictionary.footer.changingLines}</Link></li><li><Link href="/hexagrams" className={LINK}>{dictionary.footer.hexagrams}</Link></li></ul>
          </div>
          <div>
            <p className="mystic-kicker">{dictionary.footer.trust}</p>
            <ul className="mt-4 space-y-2 text-sm"><li><Link href="/privacy" className={LINK}>{dictionary.footer.privacy}</Link></li><li><Link href="/terms" className={LINK}>{dictionary.footer.terms}</Link></li><li><Link href="/acceptable-use" className={LINK}>{dictionary.footer.acceptableUse}</Link></li><li><Link href="/help" className={LINK}>{dictionary.footer.help}</Link></li></ul>
          </div>
        </div>
        <div className="border-t border-white/[0.07] px-5 py-6 text-center font-mono text-[11px] tracking-[0.04em] text-[var(--ink-3)]">© {new Date().getFullYear()} Quick I Ching · {dictionary.footer.legalNotice} · {dictionary.footer.supportEmail}</div>
      </footer>
    );
  }

  return (
    <footer className="mt-20 border-t border-white/[0.08] bg-black/10">
      <div className="mx-auto grid max-w-[1240px] gap-9 px-5 py-14 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-3 font-semibold tracking-[0.02em]"><BrandMark size="md" />Quick I Ching</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--ink-3)]">{dictionary.footer.description}</p>
        </div>
        <div>
          <p className="mystic-kicker">{dictionary.footer.casting}</p>
          <ul className="mt-4 space-y-2 text-sm"><li><Link href="/methods/three-coin" className={LINK}>{dictionary.footer.threeCoin}</Link></li><li><Link href="/methods/yarrow-stalks" className={LINK}>{dictionary.footer.yarrow}</Link></li><li><Link href="/methods/mei-hua-yi-shu" className={LINK}>{dictionary.footer.meiHua}</Link></li><li><Link href="/methods/manual-cast" className={LINK}>{dictionary.footer.manual}</Link></li><li><Link href="/history" className={LINK}>{dictionary.footer.localHistory}</Link></li><li><Link href="/hexagrams" className={LINK}>{dictionary.footer.hexagrams}</Link></li></ul>
        </div>
        <div>
          <p className="mystic-kicker">{dictionary.footer.guides}</p>
          <ul className="mt-4 space-y-2 text-sm"><li><Link href="/guides/how-to-ask-the-i-ching" className={LINK}>{dictionary.footer.howToAsk}</Link></li><li><Link href="/guides/changing-lines" className={LINK}>{dictionary.footer.changingLines}</Link></li><li><Link href="/guides/primary-relating-hexagrams" className={LINK}>{dictionary.footer.primaryRelating}</Link></li></ul>
        </div>
        <div>
          <p className="mystic-kicker">{dictionary.footer.trust}</p>
          <ul className="mt-4 space-y-2 text-sm"><li><Link href="/privacy" className={LINK}>{dictionary.footer.privacy}</Link></li><li><Link href="/terms" className={LINK}>{dictionary.footer.terms}</Link></li><li><Link href="/acceptable-use" className={LINK}>{dictionary.footer.acceptableUse}</Link></li><li><Link href="/help" className={LINK}>{dictionary.footer.help}</Link></li></ul>
        </div>
      </div>
      <div className="border-t border-white/[0.07] px-5 py-6 text-center font-mono text-[11px] tracking-[0.04em] text-[var(--ink-3)]">© {new Date().getFullYear()} Quick I Ching · {dictionary.footer.legalNotice} · {dictionary.footer.supportEmail}</div>
    </footer>
  );
}
