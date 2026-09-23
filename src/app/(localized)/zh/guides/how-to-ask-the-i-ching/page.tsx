import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("guides-how-to-ask");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle }, description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("guides-how-to-ask") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

const examples = [
  ["他会不会回来？", "在未来一个月，我需要观察哪些事实，才能判断这段关系是否值得主动修复？"],
  ["我要不要辞职？", "在决定是否离开当前工作前，我最需要看清哪些限制、资源和下一步？"],
  ["这个项目会成功吗？", "未来三个月，这个项目最值得优先验证的阻力、条件和行动是什么？"],
] as const;

export default function ChineseHowToAskGuidePage() {
  return (
    <article className="mx-auto max-w-5xl px-4 py-12 sm:py-16" data-seo-primary={SEO.primaryKeyword}>
      <nav className="text-sm text-[var(--ink-3)]" aria-label="面包屑"><Link href="/zh" className="hover:text-[var(--jade)]">中文首页</Link><span className="mx-2">/</span><span>使用指南</span></nav>
      <header className="mt-6 max-w-4xl">
        <p className="mystic-kicker">问卦前的提问方法</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{SEO.finalH1}</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">如果你在想易经怎么问，重点不是找到一句“最灵”的措辞，而是把现实处境、你真正需要判断的事情和可观察的时间范围说清楚。本站建议一次只处理一个核心问题，并把卦象作为反思框架，不把决定交给一句吉凶。</p>
      </header>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">易经怎么问：先抓住四个原则</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-2">
          <li className="mystic-card-soft p-5"><strong>一事一问。</strong><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">不要把感情、工作、钱和家庭塞进同一问。问题越聚焦，后续越容易把卦象和现实事实对应起来。</p></li>
          <li className="mystic-card-soft p-5"><strong>问自己能观察和行动的部分。</strong><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">与其要求替别人读心，不如问自己应该注意什么信号、边界和行动。</p></li>
          <li className="mystic-card-soft p-5"><strong>给出必要处境。</strong><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">对象、当前状态、已经发生的事实和时间范围足够清楚，问题就不必写得很长。</p></li>
          <li className="mystic-card-soft p-5"><strong>保留人的自主判断。</strong><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">易经问卦可以帮助整理注意力，但不能代替现实证据、他人的选择和你自己的责任。</p></li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">常见问法：从模糊到可反思</h2>
        <div className="mt-5 space-y-4">
          {examples.map(([bad, better]) => <div key={bad} className="mystic-card-soft p-5"><p className="text-sm text-[var(--ink-3)]">较模糊：{bad}</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">更清楚：</strong>{better}</p></div>)}
        </div>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-medium">是否题可以问吗</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">可以写出一个带“要不要”的现实问题，但阅读时不要强行把六十四卦压成一个二元按钮。更有用的做法是继续问：支持这个选择的条件是什么，阻力在哪里，什么事实会让你改变判断。</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium">同一个问题要不要反复问</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">如果现实条件没有变化，只因为不喜欢第一次结果而立即重复问卦，很容易把反思变成挑选答案。先记录本次问题和现实事实，等出现新信息、时间节点或新的决策条件后再重新提问更清楚。</p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">专业与安全边界</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--ink-2)]">医疗、用药、法律、投资、安全等高风险事项需要依赖合格专业人士和可验证证据。卦象不能诊断疾病、确定法律权利、替你决定交易，也不能证明某个危险行为是安全的。可以把问题改成“我需要收集哪些信息”“我应该和谁确认”“怎样降低风险”等反思方向。</p>
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
        <h2 className="font-display text-2xl font-medium">起卦前的快速检查</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">确认你只问一件事、问题包含必要处境、没有要求替别人读心或保证未来、也没有把专业判断交给卦象。准备好后，可以回到中文首页或直接使用三枚铜钱起卦。</p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm"><Link href="/zh" className="font-semibold text-[var(--jade)] hover:underline">易经在线起卦</Link><Link href="/zh/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">三枚铜钱起卦</Link><Link href="/zh/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">起卦后了解动爻</Link></div>
      </section>
    </article>
  );
}
