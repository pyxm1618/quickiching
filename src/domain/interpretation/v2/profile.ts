import type { Trigram } from "@/domain/casting/hexagrams/king-wen";
import type {
  HexagramInterpretationBundle,
  LineInterpretation,
  LinePosition,
} from "./types";

export type HexagramInterpretationProfile = {
  number: number;
  coreTheme: string;
  legacySummary: string;
  strength: string;
  challenge: string;
  orientation: string;
  transitionTheme: string;
  stabilityTheme: string;
  lowerTrigram: Trigram;
  upperTrigram: Trigram;
  lineEmphases: readonly [string, string, string, string, string, string];
};

const TRIGRAM_PRESENTATION: Record<Trigram, { label: string; meaning: string }> = {
  qian: { label: "Qian ☰ · Heaven", meaning: "initiative, direction, and creative force" },
  kun: { label: "Kun ☷ · Earth", meaning: "receptivity, support, and capacity" },
  zhen: { label: "Zhen ☳ · Thunder", meaning: "arousal, first movement, and sudden activation" },
  xun: { label: "Xun ☴ · Wind", meaning: "gradual penetration, persistence, and subtle influence" },
  kan: { label: "Kan ☵ · Water", meaning: "depth, recurring risk, and passage through uncertainty" },
  li: { label: "Li ☲ · Fire", meaning: "clarity, illumination, and dependence on what attention attaches to" },
  gen: { label: "Gen ☶ · Mountain", meaning: "stopping, boundary, and stillness" },
  dui: { label: "Dui ☱ · Lake", meaning: "exchange, openness, and responsive connection" },
};

const POSITION_PRESENTATION: Record<LinePosition, { title: string; role: string; cautionFrame: string }> = {
  1: {
    title: "Foundation",
    role: "the first emergence of the pattern, before the situation has accumulated much momentum",
    cautionFrame: "An unstable beginning becomes harder to repair once later choices are built on top of it.",
  },
  2: {
    title: "Inner center",
    role: "the pattern as it becomes workable in ordinary practice inside the situation",
    cautionFrame: "What becomes normal here can quietly become the rule that later decisions inherit.",
  },
  3: {
    title: "Inner threshold",
    role: "the pressure point at the edge of the inner trigram, where preparation is tested before moving outward",
    cautionFrame: "Extra effort is not always the same thing as a sound crossing; pressure can expose a need to reassess.",
  },
  4: {
    title: "Outer entry",
    role: "the first step into the outer trigram, where an inner approach meets wider conditions and other people",
    cautionFrame: "External reaction is information, not automatic proof that the approach is either right or wrong.",
  },
  5: {
    title: "Outer center",
    role: "a position of visible responsibility, where influence is strongest when it remains proportionate and credible",
    cautionFrame: "Visibility increases responsibility; it does not make a weak judgment stronger.",
  },
  6: {
    title: "Culmination",
    role: "the upper limit of the pattern, where completion, excess, or loss of proportion becomes easiest to see",
    cautionFrame: "What worked earlier can become distortion when repeated after the context that justified it has changed.",
  },
};

function sentenceCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function buildCoreMeaning(profile: HexagramInterpretationProfile): string {
  const lower = TRIGRAM_PRESENTATION[profile.lowerTrigram];
  const upper = TRIGRAM_PRESENTATION[profile.upperTrigram];
  return `${profile.legacySummary} Quick I Ching reads ${profile.coreTheme.toLowerCase()} as a whole-situation pattern rather than a prediction about a single event. At its best, the pattern makes use of ${profile.strength}; its main distortion appears when ${profile.challenge}. The lower trigram, ${lower.label}, describes an inner field of ${lower.meaning}, while the upper trigram, ${upper.label}, places that inner condition within an outer field of ${upper.meaning}. Together they suggest that the useful task is to ${profile.orientation}. The reading is therefore less about forcing a fixed outcome than about recognizing the structure now present, using its available strength, and watching whether your response improves or worsens that structure.`;
}

function buildStructureInterpretation(profile: HexagramInterpretationProfile): string {
  const lower = TRIGRAM_PRESENTATION[profile.lowerTrigram];
  const upper = TRIGRAM_PRESENTATION[profile.upperTrigram];
  return `Lower ${lower.label} sets the inner condition as ${lower.meaning}; upper ${upper.label} describes the outer field as ${upper.meaning}. Quick I Ching reads their relationship through the theme of ${profile.coreTheme.toLowerCase()}: the inner response must meet the outer condition without losing proportion.`;
}

function buildLineInterpretation(
  profile: HexagramInterpretationProfile,
  position: LinePosition,
  emphasis: string,
): LineInterpretation {
  const positionPresentation = POSITION_PRESENTATION[position];
  return {
    hexagramNumber: profile.number,
    position,
    theme: `${positionPresentation.title}: ${profile.coreTheme}`,
    meaning: `At ${positionPresentation.role}, this line highlights the need to ${emphasis}. Within ${profile.coreTheme.toLowerCase()}, that emphasis is a concrete way to test whether ${profile.strength} is actually operating in the situation rather than existing only as an intention or ideal.`,
    changeDynamic: `When this position changes, the reading puts extra weight on the move to ${emphasis}. It contributes to ${profile.transitionTheme}, with the line's position showing where the transformation is being tested inside the six-line structure.`,
    caution: `Watch for ${profile.challenge} while trying to ${emphasis}. ${positionPresentation.cautionFrame}`,
    reflection: `Where in the current situation would it matter most to ${emphasis}, and what observable evidence would show that this reading fits?`,
    synthesisPhrase: `${positionPresentation.title.toLowerCase()} change emphasizes the need to ${emphasis}`,
  };
}

export function buildInterpretationBundle(profile: HexagramInterpretationProfile): HexagramInterpretationBundle {
  if (!Number.isInteger(profile.number) || profile.number < 1 || profile.number > 64) {
    throw new Error(`HEXAGRAM_INTERPRETATION_INVALID_NUMBER: number=${profile.number}`);
  }
  const positions = [1, 2, 3, 4, 5, 6] as const;
  const lines = positions.map((position) => buildLineInterpretation(
    profile,
    position,
    profile.lineEmphases[position - 1],
  )) as unknown as HexagramInterpretationBundle["lines"];

  return {
    hexagram: {
      number: profile.number,
      coreTheme: profile.coreTheme,
      coreMeaning: buildCoreMeaning(profile),
      strength: `${sentenceCase(profile.strength)}.`,
      challenge: `${sentenceCase(profile.challenge)}.`,
      orientation: `${sentenceCase(profile.orientation)}.`,
      structureInterpretation: buildStructureInterpretation(profile),
      reflectionQuestions: [
        `Where is ${profile.strength} already present, and what evidence shows it is genuinely useful rather than merely appealing?`,
        `Where might ${profile.challenge} be distorting how you read the current situation?`,
        `What would it look like, in one concrete decision, to ${profile.orientation}?`,
      ],
      watchFor: [
        `Concrete signs that ${profile.strength} is becoming easier to sustain in practice.`,
        `Repeated situations where ${profile.challenge} appears and changes the quality of the outcome.`,
        `Moments when circumstances make it possible to ${profile.orientation}.`,
      ],
      transitionTheme: `${sentenceCase(profile.transitionTheme)}.`,
      stabilityTheme: `${sentenceCase(profile.stabilityTheme)}.`,
    },
    lines,
  };
}

export function buildInterpretationCatalog(
  profiles: readonly HexagramInterpretationProfile[],
): Record<number, HexagramInterpretationBundle> {
  const entries = profiles.map((profile) => [profile.number, buildInterpretationBundle(profile)] as const);
  const catalog = Object.fromEntries(entries) as Record<number, HexagramInterpretationBundle>;
  if (Object.keys(catalog).length !== profiles.length) {
    throw new Error("HEXAGRAM_INTERPRETATION_DUPLICATE_NUMBER");
  }
  return catalog;
}
