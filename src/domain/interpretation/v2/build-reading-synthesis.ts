import type {
  ActiveLineInterpretation,
  HexagramInterpretation,
  ReadingSynthesis,
} from "./types";

export type BuildReadingSynthesisInput = {
  primary: HexagramInterpretation;
  activeLines: readonly ActiveLineInterpretation[];
  relating: HexagramInterpretation | null;
};

function linePositionList(activeLines: readonly ActiveLineInterpretation[]): string {
  return activeLines.map((line) => String(line.position)).join(" · ");
}

function buildSituation(primary: HexagramInterpretation): string {
  return `${primary.coreTheme} is the main structure of this cast. Its usable strength is ${primary.strength.toLowerCase()} The main point of friction is ${primary.challenge.toLowerCase()} The broad orientation is to ${primary.orientation.replace(/^[A-Z]/, (letter) => letter.toLowerCase())}`;
}

function buildChangeSummary(activeLines: readonly ActiveLineInterpretation[]): string {
  if (activeLines.length === 0) {
    return "No changing lines were produced. The reading therefore places greater emphasis on the primary hexagram as the stable pattern of this cast.";
  }

  const linePhrases = activeLines
    .map((line) => `line ${line.position}: ${line.synthesisPhrase}`)
    .join("; ");

  if (activeLines.length === 1) {
    return `Change is concentrated at ${linePhrases}. The ${activeLines[0].changeDirection} reversal identifies one structural point where the primary pattern is being reconsidered.`;
  }

  return `Several positions are changing at once (${linePositionList(activeLines)}). Each changing position remains part of the reading: ${linePhrases}. The synthesis treats them together rather than choosing one line as the only answer.`;
}

function buildDirectionOfChange(
  primary: HexagramInterpretation,
  relating: HexagramInterpretation | null,
): string {
  if (!relating) {
    return `There is no separate relating hexagram in this cast. Direction therefore comes from deepening the stable pattern: ${primary.stabilityTheme}`;
  }

  return `The primary structure emphasizes ${primary.coreTheme}; its transition lens is ${primary.transitionTheme.toLowerCase()} After the active lines reverse, the relating structure emphasizes ${relating.coreTheme}. Quick I Ching reads that contrast as an emerging pattern for reflection, not a guaranteed future: ${relating.orientation}`;
}

function buildBottomLine(
  primary: HexagramInterpretation,
  activeLines: readonly ActiveLineInterpretation[],
  relating: HexagramInterpretation | null,
): string {
  if (activeLines.length === 0) {
    return `This cast centers on ${primary.coreTheme.toLowerCase()}. With no changing lines, the reading is less about a transition and more about recognizing the pattern already present. Use ${primary.strength.toLowerCase()} while watching for ${primary.challenge.toLowerCase()} The practical emphasis is ${primary.stabilityTheme.toLowerCase()} Treat that as a framework for observing your situation and choosing proportionate action, not as a prediction of what must happen next.`;
  }

  const positions = linePositionList(activeLines);
  const relatingClause = relating
    ? `The resulting contrast with ${relating.coreTheme} shifts attention toward ${relating.orientation.toLowerCase()}`
    : `The active lines still identify where the primary pattern is changing`;
  return `This cast begins with ${primary.coreTheme.toLowerCase()}, with change concentrated at line${activeLines.length > 1 ? "s" : ""} ${positions}. The main task is to keep ${primary.strength.toLowerCase()} from being distorted by ${primary.challenge.toLowerCase()} ${relatingClause} Read that movement as a structural direction to test against real evidence. The value of the reading is in clarifying what to notice and how to respond proportionately, not in declaring a fixed future.`;
}

export function buildReadingSynthesis({
  primary,
  activeLines,
  relating,
}: BuildReadingSynthesisInput): ReadingSynthesis {
  return {
    situation: buildSituation(primary),
    whereChangeIsHappening: buildChangeSummary(activeLines),
    directionOfChange: buildDirectionOfChange(primary, relating),
    bottomLine: buildBottomLine(primary, activeLines, relating),
  };
}
