import { AdsterraResultAd } from "@/components/ads/adsterra-result-ad";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import type { Trigram } from "@/domain/casting/hexagrams/king-wen";
import type { FreeReading } from "@/domain/interpretation/v2/types";
import styles from "./result-page.module.css";

const TRIGRAM_LABELS: Record<Trigram, string> = {
  qian: "Qian ☰ · Heaven",
  kun: "Kun ☷ · Earth",
  zhen: "Zhen ☳ · Thunder",
  xun: "Xun ☴ · Wind",
  kan: "Kan ☵ · Water",
  li: "Li ☲ · Fire",
  gen: "Gen ☶ · Mountain",
  dui: "Dui ☱ · Lake",
};

function relatingLines(lines: FreeReading["result"]["lineValuesBottomUp"]): number[] {
  return lines.map((value) => {
    if (value === 6) return 7;
    if (value === 9) return 8;
    return value;
  });
}

function movingLabel(reading: FreeReading): string {
  return reading.result.movingLinePositions.length > 0
    ? reading.result.movingLinePositions.join(" · ")
    : "None";
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

export function ReadingResultView({
  reading,
  onStartNewReading,
}: {
  reading: FreeReading;
  onStartNewReading: () => void;
}) {
  const moving = movingLabel(reading);
  const relatingValues = relatingLines(reading.result.lineValuesBottomUp);
  const relatingIdentity = reading.relating
    ? `${reading.relating.number} · ${reading.relating.englishName} · ${reading.relating.chineseName}`
    : "None";

  return (
    <article className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-12`}>
      <section className={`${styles.hero} ${styles.reveal} px-5 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12`} aria-labelledby="three-coin-result-title">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] lg:gap-12">
          <div className="min-w-0">
            <p className="mystic-kicker">Reading Overview · Three-Coin Method</p>
            <h1 id="three-coin-result-title" className="mt-3 max-w-3xl font-display text-4xl font-normal tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">Your Three-Coin Reading</h1>
            <div className="mt-7 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-sm tracking-[0.16em] text-[var(--gold)]">HEXAGRAM {reading.primary.number}</span>
              <span className="font-display text-3xl font-normal text-[var(--gold-2)] sm:text-4xl">{reading.primary.englishName}</span>
              <span className="font-cjk text-2xl text-[var(--cyan)]">{reading.primary.chineseName}</span>
            </div>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--ink-2)]">{reading.primaryInterpretation.coreTheme}. {reading.primaryInterpretation.orientation}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Primary Hexagram" value={`${reading.primary.number} · ${reading.primary.englishName}`} />
              <Fact label="Changing Lines" value={moving} />
              <Fact label="Relating Hexagram" value={relatingIdentity} />
              <Fact label="Method" value="Three-Coin Method" />
              <div className="sm:col-span-2"><Fact label="Reading Theme" value={reading.primaryInterpretation.coreTheme} /></div>
            </div>
          </div>

          <div className={`${styles.figureAura} mx-auto w-full max-w-[390px]`}>
            <HexagramLines
              lines={[...reading.result.lineValuesBottomUp]}
              size="lg"
              showLabels
              className="w-full"
            />
            <p className="mt-5 text-center text-xs leading-6 text-[var(--ink-3)]">Moving positions are marked in the figure and identified in text below.</p>
          </div>
        </div>
      </section>

      <div className={`${styles.revealDelay} mt-5 ${styles.path}`} aria-label="Primary to relating transformation path">
        <div className={styles.pathNode}>
          <p className="mystic-kicker">Primary Hexagram</p>
          <p className="mt-3 font-display text-2xl text-white">{reading.primary.number} · {reading.primary.englishName}</p>
          <p className="mt-1 font-cjk text-xl text-[var(--gold)]">{reading.primary.chineseName}</p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Current structural pattern · {reading.primaryInterpretation.coreTheme}</p>
        </div>
        <div className={styles.pathBridge}>
          <div className={styles.changeOrb}>{moving}</div>
          <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-3)]">Changing lines</p>
          <span className="sr-only">Primary Hexagram changes through positions {moving} toward the relating structure when changing lines exist.</span>
        </div>
        <div className={styles.pathNode}>
          <p className="mystic-kicker">Relating Hexagram</p>
          {reading.relating && reading.relatingInterpretation ? (
            <>
              <p className="mt-3 font-display text-2xl text-white">{reading.relating.number} · {reading.relating.englishName}</p>
              <p className="mt-1 font-cjk text-xl text-[var(--cyan)]">{reading.relating.chineseName}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Emerging contrast · {reading.relatingInterpretation.coreTheme}</p>
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-2xl text-white">No relating hexagram</p>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">No lines changed, so this cast keeps attention on the primary structure.</p>
            </>
          )}
        </div>
      </div>

      <section className={`${styles.surface} mt-10 p-5 sm:p-8 lg:p-10`} aria-labelledby="primary-heading">
        <p className="mystic-kicker">Section 2</p>
        <h2 id="primary-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">The Primary Hexagram</h2>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(250px,0.75fr)] lg:gap-10">
          <CopyBlock title="Core Meaning"><p>{reading.primaryInterpretation.coreMeaning}</p></CopyBlock>
          <div className="grid gap-6">
            <CopyBlock title="Strength"><p>{reading.primaryInterpretation.strength}</p></CopyBlock>
            <CopyBlock title="Challenge"><p>{reading.primaryInterpretation.challenge}</p></CopyBlock>
            <CopyBlock title="Orientation"><p>{reading.primaryInterpretation.orientation}</p></CopyBlock>
          </div>
        </div>
      </section>

      <section className={`${styles.surface} mt-6 p-5 sm:p-8 lg:p-10`} aria-labelledby="structure-heading">
        <p className="mystic-kicker">Section 3</p>
        <h2 id="structure-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">Understanding the Structure</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Fact label="Upper Trigram" value={TRIGRAM_LABELS[reading.primary.upper]} />
          <Fact label="Lower Trigram" value={TRIGRAM_LABELS[reading.primary.lower]} />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <CopyBlock title="Objective structure">
            <p>Lines are read bottom to top. The stored values for this cast are {reading.result.lineValuesBottomUp.join(" · ")}. Values 6 and 9 are changing; 7 and 8 are stable. The lower three lines form {TRIGRAM_LABELS[reading.primary.lower]}, and the upper three lines form {TRIGRAM_LABELS[reading.primary.upper]}.</p>
          </CopyBlock>
          <CopyBlock title="Quick I Ching interpretation"><p>{reading.primaryInterpretation.structureInterpretation}</p></CopyBlock>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="changing-lines-heading">
        <p className="mystic-kicker">Section 4</p>
        <h2 id="changing-lines-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">Changing Lines</h2>
        {reading.activeLines.length === 0 ? (
          <div className={`${styles.surface} mt-6 p-5 sm:p-7`}>
            <h3 className="font-display text-2xl font-normal text-white">No Changing Lines</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">No changing lines were produced. The reading therefore places greater emphasis on the primary hexagram as the stable pattern of this cast.</p>
          </div>
        ) : (
          <>
            {reading.activeLines.length > 1 ? (
              <div className={`${styles.surface} mt-6 border-[rgba(137,233,227,0.18)] p-5 sm:p-6`}>
                <h3 className="font-display text-2xl font-normal text-[var(--cyan)]">Multiple Changes</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Several positions are changing at once. Each changing position is shown separately, and the synthesis below brings them together rather than treating one line as the only answer.</p>
              </div>
            ) : null}
            <div className="mt-6 grid gap-5">
              {reading.activeLines.map((line) => (
                <article key={line.position} className={`${styles.lineCard} p-5 sm:p-7`} aria-labelledby={`changing-line-${line.position}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="mystic-kicker">Position {line.position} · {line.lineType}</p>
                      <h3 id={`changing-line-${line.position}`} className="mt-1 font-display text-2xl font-normal text-white sm:text-3xl">Changing Line {line.position}</h3>
                    </div>
                    <span className={styles.lineMeta}>◇ {line.lineValue} · {line.changeDirection}</span>
                  </div>
                  <p className="mt-4 text-base font-semibold text-[var(--cyan)]">{line.theme}</p>
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <CopyBlock title="What this line highlights"><p>{line.meaning}</p></CopyBlock>
                    <CopyBlock title="The change taking place"><p>{line.changeDynamic}</p></CopyBlock>
                    <CopyBlock title="Caution"><p>{line.caution}</p></CopyBlock>
                    <CopyBlock title="Reflection"><p>{line.reflection}</p></CopyBlock>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {reading.relating && reading.relatingInterpretation ? (
        <section className={`${styles.surface} mt-12 p-5 sm:p-8 lg:p-10`} aria-labelledby="relating-heading">
          <p className="mystic-kicker">Section 5</p>
          <h2 id="relating-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">The Relating Hexagram</h2>
          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)] lg:gap-10">
            <div className={`${styles.figureAura} mx-auto w-full max-w-[340px]`}>
              <p className="text-center font-mono text-xs tracking-[0.14em] text-[var(--cyan)]">HEXAGRAM {reading.relating.number}</p>
              <h3 className="mt-2 text-center font-display text-3xl font-normal text-white">{reading.relating.englishName}</h3>
              <p className="mt-1 text-center font-cjk text-2xl text-[var(--cyan)]">{reading.relating.chineseName}</p>
              <HexagramLines lines={relatingValues} size="lg" showLabels className="mt-7 w-full" />
            </div>
            <div className="grid gap-7">
              <CopyBlock title="Core Meaning"><p>{reading.relatingInterpretation.coreMeaning}</p></CopyBlock>
              <CopyBlock title="How it differs from the Primary Hexagram"><p>{reading.synthesis.directionOfChange}</p></CopyBlock>
            </div>
          </div>
        </section>
      ) : null}

      <section className={`${styles.surface} mt-12 p-5 sm:p-8 lg:p-10`} aria-labelledby="synthesis-heading">
        <p className="mystic-kicker">Section 6</p>
        <h2 id="synthesis-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] sm:text-4xl">Bringing the Reading Together</h2>
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <CopyBlock title="The Situation"><p>{reading.synthesis.situation}</p></CopyBlock>
          <CopyBlock title="Where Change Is Happening"><p>{reading.synthesis.whereChangeIsHappening}</p></CopyBlock>
          <CopyBlock title="Direction of Change"><p>{reading.synthesis.directionOfChange}</p></CopyBlock>
        </div>
      </section>

      <section className={`${styles.bottomLine} mt-6 p-6 sm:p-8 lg:p-10`} aria-labelledby="bottom-line-heading">
        <p className="mystic-kicker">Synthesis</p>
        <h2 id="bottom-line-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em] text-[var(--gold-2)] sm:text-4xl">Bottom Line</h2>
        <p className="mt-5 max-w-4xl text-base leading-8 text-[var(--ink-2)] sm:text-lg sm:leading-9">{reading.synthesis.bottomLine}</p>
      </section>

      <AdsterraResultAd />

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className={`${styles.surface} p-5 sm:p-8`} aria-labelledby="reflection-heading">
          <p className="mystic-kicker">Section 7 · Reflection</p>
          <h2 id="reflection-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em]">Questions to Sit With</h2>
          <ol className="mt-6 grid gap-4">
            {reading.primaryInterpretation.reflectionQuestions.map((question, index) => (
              <li key={question} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-sm leading-7 text-[var(--ink-2)]">
                <span className="font-mono text-xs text-[var(--gold)]">0{index + 1}</span>
                <span>{question}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.surface} p-5 sm:p-8`} aria-labelledby="watch-heading">
          <p className="mystic-kicker">Evidence in the real world</p>
          <h2 id="watch-heading" className="mt-2 font-display text-3xl font-normal tracking-[-0.035em]">What to Watch</h2>
          <ul className="mt-6 grid gap-4">
            {reading.primaryInterpretation.watchFor.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-7 text-[var(--ink-2)]">
                <span aria-hidden="true" className="mt-[0.55rem] h-2 w-2 shrink-0 rounded-full border border-[var(--cyan)] bg-[rgba(137,233,227,0.16)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={`${styles.divider} mt-12`} />
      <footer className="mx-auto mt-8 max-w-4xl text-center">
        <p className="text-xs leading-6 text-[var(--ink-3)]">Quick I Ching offers a structured framework for reflection, not a deterministic prediction. It does not replace your judgment or medical, legal, financial, or safety advice from qualified professionals.</p>
        <button type="button" className={`${styles.newReadingButton} mt-6`} onClick={onStartNewReading}>Start a New Reading</button>
      </footer>
    </article>
  );
}
