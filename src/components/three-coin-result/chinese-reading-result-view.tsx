import React from "react";
import { AdsterraResultAd } from "@/components/ads/adsterra-result-ad";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import type { FreeReading } from "@/domain/interpretation/v2/types";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import styles from "./result-page.module.css";

function relatingLines(lines: FreeReading["result"]["lineValuesBottomUp"]): number[] {
  return lines.map((value) => {
    if (value === 6) return 7;
    if (value === 9) return 8;
    return value;
  });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--ink-3)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function CopyBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-xl font-normal tracking-[-0.02em] text-[var(--gold-2)]">{title}</h3>
      <div className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-[0.96rem] sm:leading-8">{children}</div>
    </div>
  );
}

export function ChineseReadingResultView({
  reading,
  onStartNewReading,
  children,
}: {
  reading: FreeReading;
  onStartNewReading: () => void;
  children?: React.ReactNode;
}) {
  const primary = ZH_HANS_READING_CONTENT.hexagrams[reading.primary.number];
  const relating = reading.relating ? ZH_HANS_READING_CONTENT.hexagrams[reading.relating.number] : null;
  const movingPositions = reading.result.movingLinePositions;
  const movingText = movingPositions.length > 0 ? movingPositions.join("、") : "无";
  const lineValues = reading.result.lineValuesBottomUp;
  const movingRows = movingPositions.map((position) => {
    const value = lineValues[position - 1];
    return {
      position,
      value,
      label: value === 6 ? "老阴" : "老阳",
      direction: value === 6 ? "阴转阳" : "阳转阴",
    };
  });

  return (
    <article className={styles.page + " mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-12"}>
      <section className={styles.hero + " " + styles.reveal + " px-5 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12"} aria-labelledby="three-coin-result-title">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] lg:gap-12">
          <div className="min-w-0">
            <p className="mystic-kicker">三枚铜钱起卦 · 结果总览</p>
            <h1 id="three-coin-result-title" className="mt-3 max-w-3xl font-display text-4xl font-normal tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">本次三枚铜钱起卦结果</h1>
            <div className="mt-7 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-sm tracking-[0.16em] text-[var(--gold)]">第 {reading.primary.number} 卦</span>
              <span className="font-cjk text-3xl text-[var(--cyan)]">{primary?.displayName ?? reading.primary.chineseName}</span>
            </div>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--ink-2)]">{primary?.theme ?? "先从本卦理解当前结构，再看实际发生变化的爻位。"}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="本卦" value={"第 " + reading.primary.number + " 卦 · " + (primary?.displayName ?? reading.primary.chineseName)} />
              <Fact label="动爻位置" value={movingText} />
              <Fact label="之卦" value={relating ? "第 " + reading.relating!.number + " 卦 · " + relating.displayName : "无"} />
              <Fact label="起卦方法" value="三枚铜钱法" />
              <div className="sm:col-span-2"><Fact label="本卦主题" value={primary?.theme ?? "查看本卦结构与现实处境的对应。"} /></div>
            </div>
          </div>
          <div className={styles.figureAura + " mx-auto w-full max-w-[390px]"}>
            <HexagramLines lines={[...lineValues]} size="lg" showLabels locale="zh-Hans" className="w-full" />
            <p className="mt-5 text-center text-xs leading-6 text-[var(--ink-3)]">图中圆点或叉号标记动爻；六爻按自下而上的顺序读取。</p>
          </div>
        </div>
      </section>

      <p className="mt-4 rounded-2xl border border-white/[0.08] bg-black/10 px-5 py-4 text-sm leading-7 text-[var(--ink-2)]" data-free-cast-boundary>
        这部分免费内容解释卦象本身，尚未结合你的具体处境进行解读。
      </p>
      {children}

      <div className={styles.revealDelay + " mt-5 " + styles.path} aria-label="本卦到之卦的变化路径">
        <div className={styles.pathNode}>
          <p className="mystic-kicker">本卦</p>
          <p className="mt-3 font-display text-2xl text-white">第 {reading.primary.number} 卦 · {primary?.displayName ?? reading.primary.chineseName}</p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{primary?.coreMeaning ?? "这是本次起卦首先形成的六爻结构。"}</p>
        </div>
        <div className={styles.pathBridge}><div className={styles.changeOrb}>{movingPositions.length > 0 ? "变" : "定"}</div><p className="mt-3 text-center text-xs text-[var(--ink-3)]">{movingPositions.length > 0 ? "动爻：" + movingText : "无动爻"}</p></div>
        <div className={styles.pathNode}>
          <p className="mystic-kicker">之卦（变卦）</p>
          {relating ? <><p className="mt-3 font-display text-2xl text-white">第 {reading.relating!.number} 卦 · {relating.displayName}</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{relating.coreMeaning}</p></> : <><p className="mt-3 font-display text-2xl text-white">本次没有之卦</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">没有动爻，因此六爻结构不发生翻转，阅读重点停留在本卦。</p></>}
        </div>
      </div>

      <section id="general-cast-interpretation" className={styles.section + " " + styles.revealDelay} aria-labelledby="primary-heading">
        <p className="mystic-kicker">第一部分</p>
        <h2 id="primary-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">理解本卦</h2>
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <CopyBlock title="核心含义"><p>{primary?.coreMeaning ?? "先理解本卦整体结构，再把它与所问处境中的实际事实对应起来。"}</p></CopyBlock>
          <CopyBlock title="经典卦辞"><p>{primary?.judgment ?? "请进入对应六十四卦详情页查看经典文本。"}</p></CopyBlock>
          <CopyBlock title="大象"><p>{primary?.image ?? "经典大象用于观察卦象结构与行动取向。"}</p></CopyBlock>
          <CopyBlock title="阅读方式"><p>先确认本卦描述的整体关系、限制和资源，再进入具体动爻。不要只截取一句文字作为确定性结论。</p></CopyBlock>
        </div>
      </section>

      <section className={styles.section + " " + styles.revealDelay} aria-labelledby="changing-lines-heading">
        <p className="mystic-kicker">第二部分</p>
        <h2 id="changing-lines-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">动爻与变化位置</h2>
        {movingRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/15 p-6"><h3 className="font-display text-2xl font-normal text-white">没有动爻</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">六个爻都保持稳定。本次阅读不额外制造之卦，重点放在本卦本身。</p></div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {movingRows.map((row) => <div key={row.position} className="rounded-2xl border border-white/[0.08] bg-black/15 p-6"><p className="mystic-kicker">第 {row.position} 爻 · 爻值 {row.value}</p><h3 className="mt-2 font-display text-2xl font-normal text-white">{row.label} · {row.direction}</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">这一位置发生阴阳翻转。把它放回本卦整体中理解，并结合对应爻位的经典文本与现实事实核对。</p></div>)}
          </div>
        )}
      </section>

      <section className={styles.section + " " + styles.revealDelay} aria-labelledby="relating-heading">
        <p className="mystic-kicker">第三部分</p>
        <h2 id="relating-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">理解之卦</h2>
        {relating ? <div className="mt-7 grid items-center gap-8 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]"><div><HexagramLines lines={relatingLines(lineValues)} size="lg" showLabels locale="zh-Hans" /></div><div><h3 className="font-display text-3xl font-normal text-white">第 {reading.relating!.number} 卦 · {relating.displayName}</h3><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{relating.coreMeaning}</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">之卦是所有动爻同时翻转后的结构参照，不是第二次随机起卦，也不代表未来必然发生。</p></div></div> : <p className="mt-5 text-sm leading-7 text-[var(--ink-2)]">本次没有动爻，所以没有需要展示的之卦。</p>}
      </section>

      <section className={styles.section + " " + styles.revealDelay} aria-labelledby="synthesis-heading">
        <p className="mystic-kicker">第四部分 · 卦象综合</p>
        <h2 id="synthesis-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">卦象综合</h2>
        <div className="mt-7 grid gap-6 lg:grid-cols-3">
          <CopyBlock title="一般结构"><p>{primary?.coreMeaning ?? "先确认本卦的整体结构。"}</p></CopyBlock>
          <CopyBlock title="变化位置"><p>{movingPositions.length > 0 ? "本次变化集中在第 " + movingText + " 爻。先看这些位置如何改变原有结构。" : "本次没有动爻，结构保持稳定。"}</p></CopyBlock>
          <CopyBlock title="一般变化方向"><p>{relating ? relating.coreMeaning : "没有动爻，因此不需要额外的变化后结构。"}</p></CopyBlock>
        </div>
      </section>

      <AdsterraResultAd locale="zh-Hans" />

      <section className={styles.section + " " + styles.revealDelay} aria-labelledby="reflection-heading">
        <p className="mystic-kicker">第五部分 · 卦象反思</p>
        <h2 id="reflection-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em]">通用思考方向</h2>
        <div className="mt-6 grid gap-4">
          <p className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-sm leading-7 text-[var(--ink-2)]">当前处境中，哪些事实最能支持或反驳“{primary?.theme ?? "这个结构"}”这一理解？</p>
          <p className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-sm leading-7 text-[var(--ink-2)]">{movingPositions.length > 0 ? "第 " + movingText + " 爻对应的变化，在现实中有哪些可观察信号？" : "如果目前结构稳定，什么新信息出现时才值得重新评估？"}</p>
          <p className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-sm leading-7 text-[var(--ink-2)]">下一步有哪些低风险、可验证的行动，可以帮助你获得更多现实证据？</p>
        </div>
        <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-6 text-[var(--ink-3)]">Quick I Ching 提供结构化反思框架，不提供确定性预测，也不能代替你的判断或合格专业人士提供的医疗、法律、财务与安全建议。</p>
      </section>

      <div className="mt-12 text-center">
        <button type="button" onClick={onStartNewReading} className={styles.newReadingButton}>开始新的三枚铜钱起卦</button>
      </div>
    </article>
  );
}
