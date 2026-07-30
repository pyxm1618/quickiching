import type {
  HexagramResult,
  InterpretationGoal,
  Scene,
} from "@/domain/casting/types";
import type { CastingMethodEvidence } from "@/domain/casting/method-evidence";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { buildClassicReferences } from "@/domain/classics";
import type { PreviewOutput, ReadingReport, ReadingVariant } from "@/domain/readings/types";

// Explicit developmental adapter. It is deterministic and structurally valid, but it is not
// represented as reviewed production interpretation quality.

const SCENE_LABEL: Record<Scene, string> = {
  career: "your work and direction",
  relationships: "your relationships",
  wealth: "your resources and finances",
  timing: "whether the timing is right",
  choices: "a decision you face",
  personal_growth: "your own development",
  other: "what you brought to the reading",
};

const GOAL_LABEL: Record<InterpretationGoal, string> = {
  what_do_i_need_to_see_clearly: "see clearly",
  what_is_blocking_this_situation: "understand what is blocking the situation",
  what_should_i_understand_about_my_options: "understand the available options",
  what_should_i_pay_attention_to_next: "pay attention to the next observable signs",
  is_the_timing_favorable: "examine the conditions around timing",
};

const METHOD_LABEL: Record<HexagramResult["method"], string> = {
  three_coin: "three-coin method",
  yarrow_stalk: "yarrow-stalk method",
  mei_hua_current_time: "Mei Hua current-time method",
};

function variantFor(result: HexagramResult): ReadingVariant {
  const moving = result.movingLinePositions.length;
  if (moving === 0) return "still_hexagram";
  if (moving === 6) return "all_lines_moving";
  if (moving > 1) return "multiple_moving";
  return "standard";
}

function contextFocus(context: string, maximumWords = 14): string {
  const words = context.normalize("NFKC").replace(/\s+/g, " ").trim().split(" ");
  const selected = words.slice(0, maximumWords).join(" ").replace(/[.!?]+$/, "");
  return selected || "the situation you described";
}

function movingDescription(result: HexagramResult): string {
  if (result.movingLinePositions.length === 0) return "no moving line";
  if (result.movingLinePositions.length === 1) return `line ${result.movingLinePositions[0]}`;
  return result.movingLinePositions.map((line) => `line ${line}`).join(", ");
}

function evidenceDescription(evidence: CastingMethodEvidence): string {
  switch (evidence.method) {
    case "three_coin":
      return `the six persisted three-coin rounds, including all eighteen server-recorded coin values and their six derived line values`;
    case "yarrow_stalk":
      return `the eighteen persisted yarrow changes, their pile and remainder records, and the six derived line values`;
    case "mei_hua_current_time":
      return `the persisted ${evidence.calendarSystem} date calculation for ${evidence.ianaTimeZone}, the upper and lower trigrams, moving line, and body/use assignment`;
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

export function generateLocalPreview(input: {
  result: HexagramResult;
  scene: Scene;
  context: string;
}): PreviewOutput {
  const name = hexagramByNumber(input.result.primaryHexagramNumber).englishName;
  const focus = contextFocus(input.context, 10);
  return {
    relevanceStatement:
      `Your description of ${focus} and the imagery of ${name} both involve tension between an ` +
      `established arrangement and an unsettled element. The connection is relevant to ${SCENE_LABEL[input.scene]} ` +
      `without determining a stage, direction, outcome, or action for you.`,
  };
}

export function generateLocalReading(input: {
  result: HexagramResult;
  methodEvidence: CastingMethodEvidence;
  scene: Scene;
  goal: InterpretationGoal;
  context: string;
}): ReadingReport {
  const primaryName = hexagramByNumber(input.result.primaryHexagramNumber).englishName;
  const relatingName = input.result.relatingHexagramNumber == null
    ? null
    : hexagramByNumber(input.result.relatingHexagramNumber).englishName;
  const sceneLabel = SCENE_LABEL[input.scene];
  const focus = contextFocus(input.context);
  const method = METHOD_LABEL[input.result.method];
  const goal = GOAL_LABEL[input.goal];
  const moving = movingDescription(input.result);
  const variant = variantFor(input.result);

  const coreSummary =
    `The main tension in your description of ${focus} is between an established arrangement and pressure for a different fit. ` +
    `The ${method} produced ${primaryName}, so the present pattern is treated as structured but not necessarily settled. ` +
    `The change focus is ${moving}, which concentrates attention on where the arrangement can shift. ` +
    `Because your stated goal is to ${goal}, the most useful evidence is what becomes observable rather than any promised outcome.`;

  const currentStage =
    `Stage: forming. The pattern is classified this way because ${primaryName} establishes the broad environment while ${moving} ` +
    `shows that part of the arrangement is still being defined. This is an early-to-middle phase of clarification rather than a completed transition.`;

  const primaryHexagramPattern =
    `${primaryName} frames ${sceneLabel} as a relationship among your stated concern, other people, and external conditions. ` +
    `The existing structure is comparatively stable, while expectations and practical coordination remain less stable. ` +
    `That imbalance helps explain why the situation can appear recognizable yet still resist a final interpretation.`;

  let changeMechanism: string;
  if (variant === "still_hexagram") {
    changeMechanism =
      `Still Hexagram and Stabilizing Forces: there is no moving line, so the developmental reading emphasizes maintenance of the current configuration. ` +
      `The ${method} facts do not identify a separate pivot. Change therefore remains conditional on new real-world information rather than an internal line transformation.`;
  } else if (variant === "all_lines_moving") {
    changeMechanism =
      `Transformation of the Whole Structure: line 1, line 2, line 3, line 4, line 5, and line 6 all move. ` +
      `The ${method} therefore describes comprehensive reconfiguration rather than one isolated pivot. ` +
      `The useful logic is to examine how the entire arrangement changes together instead of treating any single line as sufficient.`;
  } else if (variant === "multiple_moving") {
    changeMechanism =
      `${moving} are the moving facts recorded by the ${method}. They are interpreted as a connected sequence: earlier positions establish conditions that later positions modify. ` +
      `The dominant mechanism is cumulative change, with each recorded line remaining traceable to the persisted casting result.`;
  } else {
    changeMechanism =
      `${moving} is the single moving fact recorded by the ${method}. It is the principal axis of change and identifies the first assumption, boundary, or commitment that may need revision. ` +
      `The other five lines remain the stable context that gives this one movement its significance.`;
  }

  const possibleDirection = relatingName
    ? `The relating hexagram, ${relatingName}, describes a possible structure that could emerge if the recorded movement continues. ` +
      `It is not a forecast. Clearer expectations and consistent follow-through could support that direction, while unresolved constraints could preserve the present pattern.`
    : `There is no relating hexagram because no line moves. The possible direction therefore depends on new external conditions rather than a transformation already encoded in the result. ` +
      `The current arrangement could persist, but it remains open to revision when materially new information appears.`;

  const obstaclesAndBlindSpots =
    `The main obstacle is treating one delay, message, or emotional reaction as the entire pattern. ` +
    `A blind spot would be assuming that everyone involved uses the same definition of progress. ` +
    `Information about authority, timing, resources, and other people's actual constraints may still be missing from the situation you described.`;

  const turningConditions =
    `Maintain the current interpretation while responsibilities become clearer, communication grows more consistent, and small commitments are followed by evidence. ` +
    `Re-evaluate it if decision authority changes, the practical scope shifts, or promised milestones repeatedly pass without observable progress. ` +
    `These are real-world conditions, not a prediction of a precise date.`;

  const conditionalActionDirection =
    `Under current conditions, observation, clarification, and reversible preparation fit the pattern better than an irreversible commitment. ` +
    `A more active orientation becomes reasonable only after authority, expectations, and timing are confirmed. ` +
    `This developmental reading keeps the final choice with the user and does not issue a command about ${sceneLabel}.`;

  const uncertaintyAndBoundaries =
    `This interpretation uses the supplied context, the ${method}, ${primaryName}, and ${moving}. ` +
    `It cannot account for undisclosed constraints or future decisions by other people. ` +
    `It offers a self-reflection framework and is not medical, legal, financial, safety, or other professional advice.`;

  const interpretiveBasis =
    `Interpretive Basis: this reading is anchored in ${evidenceDescription(input.methodEvidence)}, the controlled judgment reference for ${primaryName}, ` +
    `${input.result.movingLinePositions.length === 0 ? "the absence of moving-line references" : `the controlled references for ${moving}`}, ` +
    `and ${relatingName ? `the relating-hexagram judgment reference for ${relatingName}` : "the absence of a relating hexagram"}. ` +
    `The source identifiers establish provenance; the explanatory prose is a modern interpretation and is not presented as a classical quotation.`;

  return {
    readingVariant: variant,
    coreSummary,
    currentStage,
    primaryHexagramPattern,
    changeMechanism,
    possibleDirection,
    obstaclesAndBlindSpots,
    turningConditions,
    conditionalActionDirection,
    uncertaintyAndBoundaries,
    interpretiveBasis,
    interpretiveBasisReferences: buildClassicReferences(input.result),
  };
}
