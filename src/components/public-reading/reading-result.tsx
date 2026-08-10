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
    <section className="mt-8 rounded-2xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 sm:p-8" aria-live="polite" aria-labelledby="reading-result-title">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Free basic interpretation</p>
      <h3 id="reading-result-title" className="mt-2 font-display text-2xl font-medium">Your I Ching reading</h3>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--bronze)]">Primary Hexagram</p>
          <h4 className="mt-2 font-display text-xl font-medium">
            {reading.primary.number}. {reading.primary.englishName} <span className="font-cjk">{reading.primary.chineseName}</span>
          </h4>
          <HexagramLines lines={[...result.lineValuesBottomUp]} size="lg" showLabels className="mt-6 max-w-sm" />
          <p className="mt-5 text-sm leading-7 text-[var(--ink-2)]">
            <strong className="text-[var(--ink)]">{reading.primaryInterpretation.theme}.</strong>{" "}
            {reading.primaryInterpretation.summary}
          </p>
        </article>

        <div className="space-y-6">
          <article className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--bronze)]">Changing Lines</p>
            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{movingLabel}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{reading.changeExplanation}</p>
          </article>

          {reading.relating && reading.relatingInterpretation ? (
            <article className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--bronze)]">Relating Hexagram</p>
              <h4 className="mt-2 font-display text-xl font-medium">
                {reading.relating.number}. {reading.relating.englishName} <span className="font-cjk">{reading.relating.chineseName}</span>
              </h4>
              <HexagramLines lines={relatingLines(result.lineValuesBottomUp)} size="md" className="mt-5 max-w-xs" />
              <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">
                <strong className="text-[var(--ink)]">{reading.relatingInterpretation.theme}.</strong>{" "}
                {reading.relatingInterpretation.summary}
              </p>
            </article>
          ) : (
            <article className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--bronze)]">Relating Hexagram</p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">No relating hexagram is produced when there are no changing lines.</p>
            </article>
          )}
        </div>
      </div>

      <p className="mt-6 border-t border-[var(--line)] pt-5 text-xs leading-6 text-[var(--ink-3)]">
        This is a general interpretive framework for reflection, not a deterministic prediction and not medical, legal, financial, or safety advice. Keep real-world evidence and your own judgment in the decision.
      </p>
    </section>
  );
}
