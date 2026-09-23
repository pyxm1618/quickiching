import type { Metadata } from "next";
import Link from "next/link";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";
import { getDictionary } from "@/i18n/dictionaries";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("homepage");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle },
  description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("homepage") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "website", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

const methods = [
  {
    title: "三枚铜钱起卦",
    href: "/zh/methods/three-coin",
    body: "连续六次掷三枚铜钱，自下而上形成六爻。6 与 9 作为动爻，自动计算本卦和之卦。",
  },
  {
    title: "手动起卦",
    href: "/zh/methods/manual-cast",
    body: "已经有六个爻值或明确的本卦与动爻时直接输入，不引入新的随机结果。",
  },
  {
    title: "蓍草起卦",
    href: "/zh/methods/yarrow-stalks",
    body: "按 49 蓍草的数字化约定完成三变成爻、十八变成卦，并保留每一步运算记录。",
  },
  {
    title: "梅花易数起卦",
    href: "/zh/methods/mei-hua-yi-shu",
    body: "使用公开说明的公历当前时间约定，固定时区、时刻、上下卦与动爻计算过程。",
  },
] as const;

const faqs = [
  {
    q: "易经在线起卦需要登录吗？",
    a: "基础起卦与基础结果不要求登录。已完成的起卦可以保存在当前浏览器记录中；涉及账户或其他商业能力时再按页面提示处理。",
  },
  {
    q: "三枚铜钱、蓍草、梅花易数的结果可以直接比较吗？",
    a: "它们都生成六爻结构，但形成六爻的方法不同。不要为了挑选喜欢的答案，对同一问题连续换方法重起；先明确问题和方法，再完成一次完整流程。",
  },
  {
    q: "没有动爻为什么看不到之卦？",
    a: "之卦来自实际动爻的阴阳翻转。没有动爻就没有需要翻转的位置，因此本站只显示本卦，不人为制造第二个卦。",
  },
  {
    q: "在线起卦会替我做决定吗？",
    a: "不会。卦象用于整理结构、变化位置和反思问题，不是确定性预测，也不能替代医疗、法律、财务、安全等专业判断。",
  },
] as const;

export default function ChineseHomePage() {
  const dictionary = getDictionary("zh-Hans");

  return (
    <article data-seo-primary={SEO.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: SEO.finalH1,
        description: SEO.finalDescription,
        url: CANONICAL,
        inLanguage: "zh-Hans",
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }) }} />

      <header className="mx-auto max-w-5xl px-4 pb-10 pt-14 sm:pb-12 sm:pt-20">
        <p className="mystic-kicker">周易 · 四种起卦方法 · 中文六十四卦</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-medium tracking-[-0.035em] sm:text-6xl">{SEO.finalH1}</h1>
        <p data-seo-early-copy className="mt-6 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">
          Quick I Ching 的中文站现在提供完整易经在线起卦流程：先把问题写清楚，再选择三枚铜钱、蓍草、梅花易数或手动起卦。结果会展示本卦、动爻、存在时的之卦，并连接到中文六十四卦和阅读指南。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#three-coin-cast" className="mystic-button">直接三枚铜钱起卦</a>
          <Link href="/zh/hexagrams" className="mystic-button-secondary">浏览易经六十四卦</Link>
          <Link href="/zh/guides/how-to-ask-the-i-ching" className="mystic-button-secondary">先看如何提问</Link>
        </div>
      </header>

      <section id="three-coin-cast" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16" aria-labelledby="home-cast-title">
        <div className="mb-7 max-w-3xl">
          <p className="mystic-kicker">默认入口 · 三枚铜钱法</p>
          <h2 id="home-cast-title" className="mt-2 font-display text-3xl font-normal sm:text-4xl">用易经在线起卦直接完成六次掷币</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">首页默认提供三枚铜钱起卦。问题可以不填，但如果你希望之后回看这次结果，建议先写下一个明确的问题和现实处境。</p>
        </div>
        <QuestionFirst storageKey="quickiching:public-v1:three-coin" legacyStorageKeys={["quickiching:question:home-three-coin", "quickiching:question:three-coin"]} dictionary={dictionary}>
          <ThreeCoinTool compactIntro dictionary={dictionary} localizedContent={ZH_HANS_READING_CONTENT} />
        </QuestionFirst>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="methods-title">
        <p className="mystic-kicker">选择适合你的方法</p>
        <h2 id="methods-title" className="mt-2 font-display text-3xl font-normal sm:text-4xl">四种易经在线起卦方法</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">不同方法解决的是“怎样形成六爻”这一环节。进入结果后，本卦、动爻与之卦都使用同一套确定性结构计算。</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {methods.map((method) => (
            <Link key={method.href} href={method.href} className="mystic-card-soft block p-6 transition-transform hover:-translate-y-0.5">
              <h3 className="font-display text-2xl font-medium">{method.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{method.body}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-[var(--jade)]">进入中文工具 →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="how-title">
        <p className="mystic-kicker">从问题到结果</p>
        <h2 id="how-title" className="mt-2 font-display text-3xl font-normal sm:text-4xl">易经在线起卦怎么使用</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">一、提问</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">一次只处理一个核心问题。尽量写清对象、处境和需要判断的事情，不要求卦象替别人表态。</p></div>
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">二、起卦</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">选定一种方法并完成它。不要因为不喜欢中途结果而编辑已经形成的爻或马上换方法重起。</p></div>
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">三、理解</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">先看本卦，再看动爻，最后在存在变化时看之卦。六十四卦详情可继续核对经典文本和结构说明。</p></div>
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">四、回到现实</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">把卦象转成需要观察的事实、边界和下一步行动。新的信息出现后，再决定是否需要重新提问。</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="reading-title">
        <p className="mystic-kicker">阅读结构</p>
        <h2 id="reading-title" className="mt-2 font-display text-3xl font-normal sm:text-4xl">理解一次易经在线起卦结果</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="mystic-card-soft p-6"><h3 className="font-display text-2xl font-medium">本卦</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">最初形成的六爻结构。先用它理解当下的整体形态，再进入具体变化位置。</p><Link href="/zh/hexagrams" className="mt-4 inline-flex text-sm font-semibold text-[var(--jade)] hover:underline">查易经六十四卦</Link></div>
          <div className="mystic-card-soft p-6"><h3 className="font-display text-2xl font-medium">动爻</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">实际发生阴阳翻转的爻。它指出结构中的变化位置，不等于一个脱离本卦的独立预言。</p><Link href="/zh/guides/changing-lines" className="mt-4 inline-flex text-sm font-semibold text-[var(--jade)] hover:underline">查看动爻说明</Link></div>
          <div className="mystic-card-soft p-6"><h3 className="font-display text-2xl font-medium">之卦（变卦）</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">所有动爻翻转后的六爻结构。没有动爻时不生成，用作观察变化方向的第二个结构参照。</p><Link href="/zh/guides/primary-relating-hexagrams" className="mt-4 inline-flex text-sm font-semibold text-[var(--jade)] hover:underline">理解本卦与之卦</Link></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="get-title">
        <h2 id="get-title" className="font-display text-3xl font-normal sm:text-4xl">一次中文起卦可以得到什么</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">免费基础结果</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">六爻、本卦、动爻、之卦和基础中文结构说明均可直接查看。</p></div>
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">可复核的起卦事实</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">工具展示方法相关事实，例如铜钱爻值、蓍草变化步骤或梅花易数时间约定。</p></div>
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">传统爻值结构</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">三枚铜钱和蓍草使用 6、7、8、9 表示老阴、少阳、少阴和老阳。</p></div>
          <div className="mystic-card-soft p-5"><h3 className="font-display text-xl font-medium">浏览器内记录</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">支持的基础起卦流程在浏览器会话中保留进度；已保存的本地记录可以从中文历史页查看。</p></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 lg:grid-cols-2">
        <div className="mystic-card p-7">
          <p className="mystic-kicker">中文参考库</p>
          <h2 className="mt-2 font-display text-3xl font-normal">易经六十四卦</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">按文王卦序进入 64 个独立中文详情页，查看每一卦的关键词体系、经典卦辞、大象、六条爻辞、结构说明和站内前后卦导航。</p>
          <Link href="/zh/hexagrams" data-seo-inbound-anchor="易经六十四卦" className="mt-6 inline-flex font-semibold text-[var(--jade)] hover:underline">浏览易经六十四卦 →</Link>
        </div>
        <div className="mystic-card p-7">
          <p className="mystic-kicker">中文指南</p>
          <h2 className="mt-2 font-display text-3xl font-normal">起卦前后都能继续查</h2>
          <div className="mt-5 space-y-3 text-sm">
            <Link href="/zh/guides/how-to-ask-the-i-ching" className="block font-semibold text-[var(--jade)] hover:underline">易经怎么问：提问写法与边界 →</Link>
            <Link href="/zh/guides/changing-lines" className="block font-semibold text-[var(--jade)] hover:underline">易经动爻：6、9 与变卦怎么生成 →</Link>
            <Link href="/zh/guides/primary-relating-hexagrams" className="block font-semibold text-[var(--jade)] hover:underline">本卦变卦：本卦、动爻与之卦 →</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14" aria-labelledby="faq-title">
        <p className="mystic-kicker">常见问题</p>
        <h2 id="faq-title" className="mt-2 font-display text-3xl font-normal sm:text-4xl">关于易经在线起卦的常见问题</h2>
        <div className="mt-8 space-y-4">
          {faqs.map((faq) => (
            <section key={faq.q} className="mystic-card-soft p-6">
              <h3 className="font-display text-xl font-medium">{faq.q}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{faq.a}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 text-center">
        <p className="mystic-kicker">准备开始</p>
        <h2 className="mt-2 font-display text-3xl font-normal sm:text-4xl">选择一种方法，完成一次完整起卦</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">易经在线起卦的重点不是反复生成答案，而是把一次问题、一次起卦和一次阅读完整走完，再回到现实里核对。</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/zh/methods/three-coin" className="mystic-button">三枚铜钱起卦</Link>
          <Link href="/zh/methods/yarrow-stalks" className="mystic-button-secondary">蓍草起卦</Link>
          <Link href="/zh/methods/mei-hua-yi-shu" className="mystic-button-secondary">梅花易数起卦</Link>
          <Link href="/zh/methods/manual-cast" className="mystic-button-secondary">手动起卦</Link>
        </div>
      </section>
    </article>
  );
}
