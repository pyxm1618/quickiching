import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";

const NAV_LINK_CLASS =
  "relative inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)]";

const MENU_LINK_CLASS =
  "flex min-h-11 items-center rounded-lg px-3.5 py-2.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]";

const MOBILE_LINK_CLASS =
  "flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]";

export function SiteHeader({ locale = "en" }: { locale?: ContentLocale }) {
  const dictionary = getDictionary(locale);
  const isChinese = locale === "zh-Hans";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#09070f]/95 lg:bg-[#09070f]/90">
      <div className="mx-auto flex min-h-[74px] max-w-[1240px] items-center justify-between gap-x-6 px-5 py-2 sm:px-7">
        <Link
          href={isChinese ? "/zh" : "/"}
          className="flex min-h-11 items-center gap-3 font-semibold tracking-[0.02em] text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cinnabar)]"
        >
          <BrandMark size="md" />
          <span>Quick I Ching</span>
        </Link>

        <nav className="hidden items-center gap-x-6 lg:flex" aria-label={dictionary.nav.ariaLabel}>
          {isChinese ? (
            <>
              <Link href="/zh/methods/mei-hua-yi-shu" className={NAV_LINK_CLASS}>{dictionary.nav.meiHua}</Link>
              <Link href="/zh/hexagrams" className={NAV_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
            </>
          ) : (
            <>
              <details className="group relative">
                <summary className={`${NAV_LINK_CLASS} cursor-pointer list-none gap-1 marker:content-none`}>
                  {dictionary.nav.methods}<span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[210px] rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-1.5 shadow-xl">
                  <Link href="/methods/three-coin" className={MENU_LINK_CLASS}>{dictionary.nav.threeCoin}</Link>
                  <Link href="/methods/yarrow-stalks" className={MENU_LINK_CLASS}>{dictionary.nav.yarrow}</Link>
                  <Link href="/methods/mei-hua-yi-shu" className={MENU_LINK_CLASS}>{dictionary.nav.meiHua}</Link>
                  <Link href="/methods/manual-cast" className={MENU_LINK_CLASS}>{dictionary.nav.manual}</Link>
                </div>
              </details>

              <details className="group relative">
                <summary className={`${NAV_LINK_CLASS} cursor-pointer list-none gap-1 marker:content-none`}>
                  {dictionary.nav.guides}<span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[245px] rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-1.5 shadow-xl">
                  <Link href="/guides/how-to-ask-the-i-ching" className={MENU_LINK_CLASS}>{dictionary.nav.howToAsk}</Link>
                  <Link href="/guides/changing-lines" className={MENU_LINK_CLASS}>{dictionary.nav.changingLines}</Link>
                  <Link href="/guides/primary-relating-hexagrams" className={MENU_LINK_CLASS}>{dictionary.nav.primaryRelating}</Link>
                </div>
              </details>

              <Link href="/hexagrams" className={NAV_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
              <Link href="/history" className={NAV_LINK_CLASS}>{dictionary.nav.history}</Link>
            </>
          )}

          <LanguageSwitcher locale={locale} labels={dictionary.language} idPrefix="desktop" />
        </nav>

        <div className="lg:hidden">
          <details className="group relative">
            <summary
              aria-label={dictionary.nav.toggleMenu}
              className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 text-lg text-[var(--ink-2)] marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]"
            >
              <span aria-hidden="true">☰</span>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-6rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-2xl">
              <nav className="space-y-4" aria-label={dictionary.nav.ariaLabel}>
                {isChinese ? (
                  <div className="space-y-1">
                    <Link href="/zh" className={MOBILE_LINK_CLASS}>{dictionary.nav.home}</Link>
                    <Link href="/zh/methods/mei-hua-yi-shu" className={MOBILE_LINK_CLASS}>{dictionary.nav.meiHua}</Link>
                    <Link href="/zh/hexagrams" className={MOBILE_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.nav.methods}</p>
                      <Link href="/methods/three-coin" className={MOBILE_LINK_CLASS}>{dictionary.nav.threeCoin}</Link>
                      <Link href="/methods/yarrow-stalks" className={MOBILE_LINK_CLASS}>{dictionary.nav.yarrow}</Link>
                      <Link href="/methods/mei-hua-yi-shu" className={MOBILE_LINK_CLASS}>{dictionary.nav.meiHua}</Link>
                      <Link href="/methods/manual-cast" className={MOBILE_LINK_CLASS}>{dictionary.nav.manual}</Link>
                    </div>
                    <div className="space-y-1">
                      <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.nav.guides}</p>
                      <Link href="/guides/how-to-ask-the-i-ching" className={MOBILE_LINK_CLASS}>{dictionary.nav.howToAsk}</Link>
                      <Link href="/guides/changing-lines" className={MOBILE_LINK_CLASS}>{dictionary.nav.changingLines}</Link>
                      <Link href="/guides/primary-relating-hexagrams" className={MOBILE_LINK_CLASS}>{dictionary.nav.primaryRelating}</Link>
                    </div>
                    <div className="space-y-1">
                      <Link href="/hexagrams" className={MOBILE_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
                      <Link href="/history" className={MOBILE_LINK_CLASS}>{dictionary.nav.history}</Link>
                    </div>
                  </>
                )}
              </nav>
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <LanguageSwitcher locale={locale} labels={dictionary.language} idPrefix="mobile" className="w-full" fullWidth placement="up" />
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
