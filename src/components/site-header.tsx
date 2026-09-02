import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteHeaderBehavior } from "@/components/site-header-behavior";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";

const NAV_LINK_CLASS =
  "relative min-h-11 inline-flex items-center text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] after:absolute after:bottom-1 after:left-0 after:h-px after:w-0 after:bg-[var(--cinnabar)] after:transition-all hover:after:w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)]";

const DROPDOWN_BTN_CLASS =
  "relative min-h-11 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)] cursor-pointer";

const MENU_ITEM_CLASS =
  "flex min-h-11 w-full items-center rounded-lg px-3.5 py-2.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)] focus:bg-white/[0.1] focus:text-[var(--ink)] focus:outline-none";

const DRAWER_LINK_CLASS =
  "flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]";

function ChevronIcon() {
  return (
    <svg data-nav-chevron className="h-3.5 w-3.5 transition-transform duration-200" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader({ locale = "en" }: { locale?: ContentLocale }) {
  const dictionary = getDictionary(locale);
  const isChinese = locale === "zh-Hans";

  return (
    <header data-site-header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#09070f]/80 backdrop-blur-[18px]">
      <div className="mx-auto flex min-h-[74px] max-w-[1240px] items-center justify-between gap-x-6 px-5 py-2 sm:px-7">
        <Link
          data-header-brand
          href={isChinese ? "/zh" : "/"}
          className="flex min-h-11 items-center gap-3 font-semibold tracking-[0.02em] text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cinnabar)]"
        >
          <BrandMark size="md" priority />
          <span>Quick I Ching</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-x-6" aria-label={dictionary.nav.ariaLabel}>
          {isChinese ? (
            <>
              <Link href="/zh/methods/mei-hua-yi-shu" className={NAV_LINK_CLASS}>{dictionary.nav.meiHua}</Link>
              <Link href="/zh/hexagrams" className={NAV_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
            </>
          ) : (
            <>
              <div data-header-menu="methods" className="relative inline-block text-left">
                <button
                  id="methods-trig-site"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-controls="methods-menu-site"
                  className={DROPDOWN_BTN_CLASS}
                >
                  <span>{dictionary.nav.methods}</span>
                  <ChevronIcon />
                </button>
                <div
                  id="methods-menu-site"
                  role="menu"
                  aria-labelledby="methods-trig-site"
                  className="absolute left-0 mt-1.5 z-50 hidden min-w-[200px] origin-top-left rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-1.5 shadow-xl backdrop-blur-md focus:outline-none"
                >
                  <Link href="/methods/three-coin" role="menuitem" tabIndex={-1} className={MENU_ITEM_CLASS}>{dictionary.nav.threeCoin}</Link>
                  <Link href="/methods/yarrow-stalks" role="menuitem" tabIndex={-1} className={MENU_ITEM_CLASS}>{dictionary.nav.yarrow}</Link>
                  <Link href="/methods/mei-hua-yi-shu" role="menuitem" tabIndex={-1} className={MENU_ITEM_CLASS}>{dictionary.nav.meiHua}</Link>
                  <Link href="/methods/manual-cast" role="menuitem" tabIndex={-1} className={MENU_ITEM_CLASS}>{dictionary.nav.manual}</Link>
                </div>
              </div>

              <div data-header-menu="guides" className="relative inline-block text-left">
                <button
                  id="guides-trig-site"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-controls="guides-menu-site"
                  className={DROPDOWN_BTN_CLASS}
                >
                  <span>{dictionary.nav.guides}</span>
                  <ChevronIcon />
                </button>
                <div
                  id="guides-menu-site"
                  role="menu"
                  aria-labelledby="guides-trig-site"
                  className="absolute left-0 mt-1.5 z-50 hidden min-w-[240px] origin-top-left rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-1.5 shadow-xl backdrop-blur-md focus:outline-none"
                >
                  <Link href="/guides/how-to-ask-the-i-ching" role="menuitem" tabIndex={-1} className={MENU_ITEM_CLASS}>{dictionary.nav.howToAsk}</Link>
                  <Link href="/guides/changing-lines" role="menuitem" tabIndex={-1} className={MENU_ITEM_CLASS}>{dictionary.nav.changingLines}</Link>
                  <Link href="/guides/primary-relating-hexagrams" role="menuitem" tabIndex={-1} className={MENU_ITEM_CLASS}>{dictionary.nav.primaryRelating}</Link>
                </div>
              </div>

              <Link href="/hexagrams" className={NAV_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
              <Link href="/history" className={NAV_LINK_CLASS}>{dictionary.nav.history}</Link>
            </>
          )}

          <LanguageSwitcher locale={locale} labels={dictionary.language} idPrefix="desktop" />
        </nav>

        <div className="flex lg:hidden items-center gap-2">
          <button
            id="drawer-trig-site"
            type="button"
            aria-expanded="false"
            aria-controls="nav-drawer-site"
            aria-label={dictionary.nav.toggleMenu}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] p-2 text-[var(--ink-2)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)] cursor-pointer"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      <div id="nav-drawer-site" className="fixed inset-0 z-[100] hidden lg:hidden">
        <div data-drawer-backdrop className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
        <div
          data-nav-dialog
          aria-label={dictionary.nav.ariaLabel}
          className="absolute inset-y-0 right-0 z-10 flex h-dvh w-[calc(100vw-2rem)] max-w-xs flex-col border-l border-[var(--line)] bg-[var(--paper)] p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <span className="font-display font-medium text-lg text-[var(--ink)]">{dictionary.nav.drawerTitle}</span>
            <button
              data-drawer-close
              type="button"
              aria-label={dictionary.nav.closeMenu}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--line)] p-2 text-[var(--ink-2)] hover:bg-white/[0.08] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)] cursor-pointer"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="mt-6 flex-1 space-y-6 overflow-y-auto" aria-label={dictionary.nav.ariaLabel}>
            {isChinese ? (
              <div className="space-y-1">
                <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">中文导航</p>
                <Link href="/zh" className={DRAWER_LINK_CLASS}>{dictionary.nav.home}</Link>
                <Link href="/zh/methods/mei-hua-yi-shu" className={DRAWER_LINK_CLASS}>{dictionary.nav.meiHua}</Link>
                <Link href="/zh/hexagrams" className={DRAWER_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.nav.methods}</p>
                  <Link href="/methods/three-coin" className={DRAWER_LINK_CLASS}>{dictionary.nav.threeCoin}</Link>
                  <Link href="/methods/yarrow-stalks" className={DRAWER_LINK_CLASS}>{dictionary.nav.yarrow}</Link>
                  <Link href="/methods/mei-hua-yi-shu" className={DRAWER_LINK_CLASS}>{dictionary.nav.meiHua}</Link>
                  <Link href="/methods/manual-cast" className={DRAWER_LINK_CLASS}>{dictionary.nav.manual}</Link>
                </div>
                <div className="space-y-1">
                  <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">{dictionary.nav.guides}</p>
                  <Link href="/guides/how-to-ask-the-i-ching" className={DRAWER_LINK_CLASS}>{dictionary.nav.howToAsk}</Link>
                  <Link href="/guides/changing-lines" className={DRAWER_LINK_CLASS}>{dictionary.nav.changingLines}</Link>
                  <Link href="/guides/primary-relating-hexagrams" className={DRAWER_LINK_CLASS}>{dictionary.nav.primaryRelating}</Link>
                </div>
                <div className="space-y-1">
                  <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Reference</p>
                  <Link href="/hexagrams" className={DRAWER_LINK_CLASS}>{dictionary.nav.hexagrams}</Link>
                  <Link href="/history" className={DRAWER_LINK_CLASS}>{dictionary.nav.history}</Link>
                </div>
              </>
            )}
          </nav>

          <div className="border-t border-[var(--line)] pt-4">
            <p className="mb-2 px-1 font-mono text-[11px] text-[var(--ink-3)]">{dictionary.nav.languageLabel}</p>
            <LanguageSwitcher locale={locale} labels={dictionary.language} idPrefix="drawer" className="w-full" fullWidth placement="up" />
          </div>
        </div>
      </div>

      <SiteHeaderBehavior />
    </header>
  );
}
