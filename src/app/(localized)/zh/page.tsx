import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { getDictionary } from "@/i18n/dictionaries";

export function generateMetadata(): Metadata {
  const canonical = canonicalUrl("/zh");
  return {
    title: "易经在线｜Quick I Ching 中文入口",
    description: "Quick I Ching 中文入口：了解当前中文支持范围，并使用公开说明的公历时间约定进行梅花易数时间起卦。",
    alternates: { canonical, languages: alternateLanguages("homepage") },
    openGraph: {
      title: "易经在线｜Quick I Ching 中文入口",
      description: "使用公开说明的公历时间约定进行梅花易数时间起卦。",
      url: canonical,
      type: "website",
      locale: "zh_CN",
    },
  };
}

export default function ChineseHomePage() {
  const dictionary = getDictionary("zh-Hans");
  return (
    <article>
      <section className="border-b border-white/[0.07]">
        <div className="mystic-shell grid min-h-[500px] items-center gap-10 py-16 lg:grid-cols-[1.08fr_.92fr] lg:gap-16 lg:py-20">
          <div>
            <p className="mystic-kicker">Quick I Ching · 易经在线</p>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.75rem,6vw,5.6rem)] font-normal leading-[1.05] tracking-[-.055em]">用易经整理问题，回到现实行动</h1>
            <p className="mt-7 max-w-3xl text-[17px] leading-8 text-[var(--ink-2)]">Quick I Ching 是一个克制的在线起卦与反思工具。当前中文版本开放梅花易数公历时间起卦：写下问题，固定时区和当前时刻，查看本卦、动爻、之卦，再把象征性提示与现实证据放在一起思考。</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/zh/methods/mei-hua-yi-shu" className="mystic-button">开始梅花易数时间起卦</Link>
              <Link href="/" className="mystic-button-secondary">{dictionary.nav.englishSite}</Link>
            </div>
          </div>
          <div className="mystic-card-soft p-6 sm:p-8">
            <p className="mystic-kicker">当前中文支持</p>
            <h2 className="mt-3 font-display text-3xl font-normal">先从一套可说明的约定开始</h2>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-[var(--ink-2)]">
              <li className="border-l border-[var(--gold)]/50 pl-4">中文提问与公历当前时间起卦</li>
              <li className="border-l border-[var(--gold)]/50 pl-4">本卦、一个动爻、之卦与基础中文说明</li>
              <li className="border-l border-[var(--gold)]/50 pl-4">明确展示 IANA 时区、公式日期与十二时辰约定</li>
            </ul>
            <p className="mt-6 border-t border-white/[0.08] pt-5 text-xs leading-6 text-[var(--ink-3)]">中文三枚铜钱、蓍草、手动起卦、64 卦中文 SEO 页面、History 和 Personalized AI 尚未开放。中文用户可以通过英文完整网站访问这些英文功能。</p>
          </div>
        </div>
      </section>

      <section className="mystic-shell py-16 sm:py-20" aria-labelledby="zh-how-title">
        <p className="mystic-kicker">一个完整的中文流程</p>
        <h2 id="zh-how-title" className="mt-2 font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">从问题到反思提示</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-4">
          {[
            ["01", "写下问题", "问题是可选的，只帮助你明确这次反思的范围，不会改变起卦事实。"],
            ["02", "固定时间", "选择有效的 IANA 时区，按公历日期和十二时辰记录当前时刻。"],
            ["03", "查看卦象", "理解本卦、动爻和之卦之间的结构关系，不把它们当作确定答案。"],
            ["04", "回到现实", "把提示和事实、他人的选择以及必要的专业意见放在一起判断。"],
          ].map(([number, title, description]) => (
            <article key={number} className="method-card-a"><p className="font-display text-3xl text-[var(--gold)]">{number}</p><h3 className="mt-5 font-display text-xl font-normal">{title}</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{description}</p></article>
          ))}
        </div>
      </section>

      <section className="mystic-shell grid gap-8 py-16 sm:py-20 md:grid-cols-2" aria-labelledby="zh-terms-title">
        <div>
          <p className="mystic-kicker">本阶段的中文定位</p>
          <h2 id="zh-terms-title" className="mt-2 font-display text-3xl font-normal">反思框架，不是确定性预言</h2>
          <p className="mt-5 text-sm leading-7 text-[var(--ink-2)]">易经可以帮助你把复杂问题分层、命名变化并提出新的观察角度。它不能保证某件事发生，也不能替代医疗、法律、财务或安全建议。现实信息与个人判断始终优先。</p>
        </div>
        <div className="mystic-card p-6">
          <p className="mystic-kicker">梅花易数时间起卦</p>
          <h3 className="mt-2 font-display text-2xl font-normal">使用公历日期与十二时辰</h3>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">本工具采用一套公开说明、适合国际网站的公历时间约定，不宣称这是唯一传统规则。你可以在结果中复查时区、公式日期、上卦、下卦和动爻。</p>
          <Link href="/zh/methods/mei-hua-yi-shu" className="mt-5 inline-flex font-semibold text-[var(--cyan)] hover:underline">阅读说明并开始起卦 →</Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-7 sm:py-20" aria-labelledby="zh-english-title">
        <p className="mystic-kicker">英文完整网站</p>
        <h2 id="zh-english-title" className="mt-2 font-display text-3xl font-normal">当前没有中文版本的页面</h2>
        <p className="mt-5 text-sm leading-7 text-[var(--ink-2)]">英文网站仍保留 Three-Coin、Yarrow Stalks、Manual Cast、64 卦英文详情、英文 History 和英文 Personalized Interpretation。语言切换器会把没有直接中文等价页的页面明确带回中文首页，而不会伪造中文正文。</p>
        <Link href="/" className="mt-6 inline-flex font-semibold text-[var(--cyan)] hover:underline">进入英文完整网站 →</Link>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "易经在线｜Quick I Ching 中文入口",
        description: "Quick I Ching 中文入口与梅花易数时间起卦说明。",
        url: canonicalUrl("/zh"),
        inLanguage: "zh-Hans",
      }) }} />
    </article>
  );
}
