import React from "react";
import type { CommercialReadingReportV2 } from "@/domain/generation/schemas";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { changeRuleFact, directionFact, linePositionFacts, tiYongFact } from "./deterministic-facts";

/**
 * Renders one finished v2 report. The two halves are kept visually separate on
 * purpose: everything under "Derived by rule" is computed from the cast and the
 * classics and no model touched it, while everything under "Interpretation" was
 * written by a model applying that fixed result to the reader's question. A
 * reader has to be able to tell which is which.
 */

function DerivedBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--line)] py-4 first:border-t-0 first:pt-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">{label}</p>
      <div className="mt-1.5 text-sm leading-7 text-[var(--ink)]">{children}</div>
    </div>
  );
}

/** An identifier we have no wording for is shown as the identifier, never guessed at. */
function FactText({ text, id }: { text: string | null; id: string }) {
  return text ? <>{text}</> : <code className="font-mono text-xs text-[var(--ink-3)]">{id}</code>;
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="mt-6">
      <h3 className="font-display text-lg font-medium tracking-[-0.01em]">{heading}</h3>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-8 text-[var(--ink-2)]">{body}</p>
    </section>
  );
}

export function DeterministicHalf({ report }: { report: CommercialReadingReportV2 }) {
  const locale = report.locale;
  const { deterministic } = report;

  const primary = hexagramByNumber(deterministic.primaryHexagramNumber);
  const relating = deterministic.relatingHexagramNumber === null
    ? null
    : hexagramByNumber(deterministic.relatingHexagramNumber);
  const nuclear = hexagramByNumber(deterministic.nuclearHexagramNumber);

  const rule = changeRuleFact(deterministic.changeRuleId, locale);
  const direction = directionFact(deterministic.direction, locale);
  const tiYong = tiYongFact(deterministic.tiYong, locale);
  const positions = linePositionFacts(deterministic.movingLinePositions, locale);

  return (
    <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--paper-raised)] p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-medium tracking-[-0.01em]">Derived by rule</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          computed, not written
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-6 text-[var(--ink-3)]">
        Fixed by the cast and the classical rules before any interpretation was requested.
      </p>

      <div className="mt-5">
        <DerivedBlock label="Hexagrams">
          <span>
            {primary.number} {primary.englishName}
            {relating ? <> → {relating.number} {relating.englishName}</> : null}
            {" · nuclear "}{nuclear.number} {nuclear.englishName}
          </span>
        </DerivedBlock>

        <DerivedBlock label="Change rule">
          <FactText text={rule.text} id={rule.id} />
        </DerivedBlock>

        {direction ? (
          <DerivedBlock label="Verdict direction">
            <FactText text={direction.text} id={direction.id} />
          </DerivedBlock>
        ) : (
          <DerivedBlock label="Verdict direction">
            <span className="text-[var(--ink-3)]">
              Not determined: the moving lines span both trigrams, so no classical direction follows.
            </span>
          </DerivedBlock>
        )}

        {tiYong ? (
          <DerivedBlock label="Ti and Yong">
            <span>
              <FactText text={tiYong.ti.text} id={tiYong.ti.id} />
              {tiYong.ti.quality ? ` (${tiYong.ti.quality})` : null}
              {" / "}
              <FactText text={tiYong.yong.text} id={tiYong.yong.id} />
              {tiYong.yong.quality ? ` (${tiYong.yong.quality})` : null}
              {" — "}
              <FactText text={tiYong.relation.text} id={tiYong.relation.id} />
            </span>
          </DerivedBlock>
        ) : null}

        {positions.length > 0 ? (
          <DerivedBlock label="Line positions">
            <ul className="space-y-1">
              {positions.map(({ position, text }) => (
                <li key={position}>
                  <span className="font-mono text-xs text-[var(--bronze)]">Line {position}</span>{" "}
                  <FactText text={text} id={String(position)} />
                </li>
              ))}
            </ul>
          </DerivedBlock>
        ) : null}

        <DerivedBlock label="Classical text">
          <ul className="space-y-3">
            {deterministic.quotes.map((quote, index) => (
              <li key={`${quote.hexagramNumber}-${quote.label}-${index}`}>
                <p className="font-mono text-[11px] text-[var(--bronze)]">
                  {quote.role === "primary" ? "Primary" : "Supporting"} · {quote.hexagramChineseName} · {quote.label}
                </p>
                <blockquote className="mt-1 border-l-2 border-[var(--line-strong)] pl-3 leading-7">
                  {quote.text}
                </blockquote>
                <a
                  className="mt-1 inline-block font-mono text-[11px] text-[var(--jade)] hover:underline"
                  href={quote.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {quote.sourceWork} ↗
                </a>
              </li>
            ))}
          </ul>
        </DerivedBlock>
      </div>
    </div>
  );
}

export function GeneratedHalf({ report }: { report: CommercialReadingReportV2 }) {
  const { generated } = report;

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-medium tracking-[-0.01em]">Interpretation</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          written for your question
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-6 text-[var(--ink-3)]">
        An application of the fixed result above to what you asked. It cannot change that result.
      </p>

      <Section heading="Your question" body={generated.questionRestatement} />
      <Section heading="What the oracle addresses" body={generated.oracleApplication} />
      <Section heading="Where this stands now" body={generated.currentStage} />
      <Section heading="The structure" body={generated.structuralReading} />
      <Section heading="How it changes" body={generated.changeMechanism} />
      <Section heading="Obstacles" body={generated.obstacles} />
      <Section heading="What would turn it" body={generated.turningConditions} />
      <Section heading="Conditional guidance" body={generated.conditionalGuidance} />
      <Section heading="Uncertainty and boundaries" body={generated.uncertaintyAndBoundaries} />

      <p className="mt-8 border-t border-[var(--line)] pt-4 text-xs leading-6 text-[var(--ink-3)]">
        {report.disclaimer}
      </p>
    </div>
  );
}

export function DeepReadingReport({ report }: { report: CommercialReadingReportV2 }) {
  return (
    <div>
      <DeterministicHalf report={report} />
      <GeneratedHalf report={report} />
    </div>
  );
}
