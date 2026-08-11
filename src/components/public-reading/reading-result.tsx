import { HexagramLines } from "@/components/hex/hexagram-lines";
import { buildBasicReading } from "@/domain/interpretation/basic";
import type { HexagramResult, LineValue } from "@/domain/casting/types";

function relatingLines(lines: readonly LineValue[]): number[] {
  return lines.map((value) => {
    if (value === 6) return 7;
    if (value === 9) return 8;
    return value;
  });
}

export function ReadingResult({ result }: { result: HexagramResult }) {
  const reading = buildBasicReading(result);
  const movingLabel = result.movingLinePositions.length
    ? result.movingLinePositions.join(", ")
    : "None";

  return (
    <section className="reading-reveal" aria-live="polite" aria-labelledby="reading-result-title">
      <div className="text-center">
        <p className="mystic-kicker">Free basic interpretation</p>
        <h3 id="reading-result-title" className="mt-2 font-display text-3xl font-normal tracking-[-0.03em] sm:text-4xl">Your I Ching reading</h3>
      </div>

      <div className="reading-path">
        <article className="reading-card-a">
          <p className="mystic-kicker">Primary Hexagram</p>
          <div className="reading-number mt-5">{reading.primary.number}</div>
          <h4 className="reading-title">{reading.primary.englishName}</h4>
          <p className="reading-cn mt-2">{reading.primary.chineseName}</p>
          <HexagramLines lines={[...result.lineValuesBottomUp]} size="lg" showLabels className="mt-8 max-w-sm" />
          <p className="reading-theme">{reading.primaryInterpretation.theme}</p>
          <p className="reading-copy">{reading.primaryInterpretation.summary}</p>
        </article>

        <div className="change-bridge" aria-label={`Changing lines: ${movingLabel}`}>
          <div className="change-orb">{movingLabel}</div>
          <small>Changing lines</small>
        </div>

        {reading.relating && reading.relatingInterpretation ? (
          <article className="reading-card-a">
            <p className="mystic-kicker">Relating Hexagram</p>
            <div className="reading-number mt-5">{reading.relating.number}</div>
            <h4 className="reading-title">{reading.relating.englishName}</h4>
            <p className="reading-cn mt-2">{reading.relating.chineseName}</p>
            <HexagramLines lines={relatingLines(result.lineValuesBottomUp)} size="lg" showLabels className="mt-8 max-w-sm" />
            <p className="reading-theme">{reading.relatingInterpretation.theme}</p>
            <p className="reading-copy">{reading.relatingInterpretation.summary}</p>
          </article>
        ) : (
          <article className="reading-card-a flex min-h-[360px] flex-col justify-center">
            <p className="mystic-kicker">Relating Hexagram</p>
            <h4 className="mt-5 font-display text-2xl font-normal">No relating hexagram</h4>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">No relating hexagram is produced when there are no changing lines.</p>
          </article>
        )}
      </div>

      <div className="change-detail">
        <strong className="text-white">Changing Lines: {movingLabel}</strong>
        <span className="mx-2 text-[var(--gold)]">◇</span>
        {reading.changeExplanation}
      </div>

      <p className="mt-7 border-t border-white/[0.08] pt-5 text-xs leading-6 text-[var(--ink-3)]">
        This is a general interpretive framework for reflection, not a deterministic prediction and not medical, legal, financial, or safety advice. Keep real-world evidence and your own judgment in the decision.
      </p>
    </section>
  );
}
