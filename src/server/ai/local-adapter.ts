import type { HexagramResult, Scene } from "@/domain/casting/types";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { ReadingReport, ReadingVariant, PreviewOutput, InterpretiveBasisReference } from "@/domain/readings/types";

// Deterministic offline generator used when AI_ADAPTER_MODE=local (the default for this MVP
// build). It is an explicit stand-in for the production AI SDK pipeline (G-06 pending). It
// honors the structural and safety constraints (no absolute predictions, no commands, fixed
// module set) but the prose quality is NOT the reviewed model output.

const SCENE_LABEL: Record<Scene, string> = {
  career: "your work and direction",
  relationships: "your relationships",
  wealth: "your resources and finances",
  timing: "whether the timing is right",
  choices: "a decision you face",
  personal_growth: "your own development",
  other: "what you brought to the reading",
};

function variantFor(result: HexagramResult): ReadingVariant {
  const n = result.movingLinePositions.length;
  if (n === 0) return "still_hexagram";
  if (n === 6) return "all_lines_moving";
  if (n > 1) return "multiple_moving";
  return "standard";
}

function referencesFor(result: HexagramResult): InterpretiveBasisReference[] {
  const refs: InterpretiveBasisReference[] = [
    { source: "king_wen_judgment", hexagramNumber: result.primaryHexagramNumber, status: "pending_license" },
  ];
  for (const pos of result.movingLinePositions) {
    refs.push({
      source: "king_wen_line",
      hexagramNumber: result.primaryHexagramNumber,
      linePosition: pos,
      status: "pending_license",
    });
  }
  if (result.relatingHexagramNumber) {
    refs.push({
      source: "relating_judgment",
      hexagramNumber: result.relatingHexagramNumber,
      status: "pending_license",
    });
  }
  return refs;
}

export function generateLocalPreview(input: {
  result: HexagramResult;
  scene: Scene;
  context: string;
}): PreviewOutput {
  const name = hexagramByNumber(input.result.primaryHexagramNumber).englishName;
  const sceneLabel = SCENE_LABEL[input.scene];
  // 25-55 words, max 2 sentences, only surface tension + surface relevance.
  // Must NOT reveal stage, trend, turning conditions, or action orientation (RESULT-002).
  const statement =
    `Your question about ${sceneLabel} and the imagery of ${name} both turn on a quiet tension ` +
    `between what feels settled and what is still moving. The pattern echoes the situation you ` +
    `described without telling you what must happen next.`;
  return { relevanceStatement: statement };
}

export function generateLocalReading(input: {
  result: HexagramResult;
  scene: Scene;
  goal: string;
  context: string;
}): ReadingReport {
  const name = hexagramByNumber(input.result.primaryHexagramNumber).englishName;
  const sceneLabel = SCENE_LABEL[input.scene];
  const moving = input.result.movingLinePositions;
  const variant = variantFor(input.result);

  const coreSummary =
    `The situation centers on a contrast between steady conditions and pressures that are shifting ` +
    `beneath them. The pattern of ${name} suggests the main tension in ${sceneLabel} is about ` +
    `whether existing structures still fit what is now occurring. Watch what changes first, and ` +
    `treat any single sign as information rather than a finished verdict.`;

  const currentStage =
    `Stage: forming. The judgment is based on the primary hexagram ${name}, where the early ` +
    `conditions are established but not yet resolved. This reading treats the present as a phase ` +
    `of arrangement rather than arrival, because the lines show forces still taking shape.`;

  const primaryHexagramPattern =
    `${name} describes an environment where the relation between you, others, and outside conditions ` +
    `is uneven. Some factors are comparatively stable; others are already unstable. The pattern ` +
    `matters more than any single element, and the reading keeps that whole before drawing conclusions.`;

  let changeMechanism: string;
  if (variant === "still_hexagram") {
    changeMechanism =
      `Still Hexagram and Stabilizing Forces: there is no moving line, so the reading emphasizes ` +
      `the present configuration as a holding pattern. The forces at work are mainly stabilizing, ` +
      `and change is more about maintenance than transformation.`;
  } else if (variant === "all_lines_moving") {
    changeMechanism =
      `Transformation of the Whole Structure: every line moves, so the reading treats this as a ` +
      `comprehensive reconfiguration rather than a single pivot. The change logic is that the ` +
      `entire situation is in transition at once, and partial fixes are unlikely to hold.`;
  } else if (variant === "multiple_moving") {
    const positions = moving.join(", ");
    changeMechanism =
      `Several lines move (${positions}). They are read as a connected sequence rather than separate ` +
      `events: earlier movements set conditions that later movements alter. The dominant logic is ` +
      `one of cumulative change, where the order of the lines tells the story of how the situation evolves.`;
  } else {
    const pos = moving[0];
    changeMechanism =
      `A single line moves at position ${pos}. That line is the main axis of change: it marks where ` +
      `the present pattern is most likely to give way. The rest of the hexagram supplies the context ` +
      `that makes that single shift meaningful.`;
  }

  const possibleDirection =
    `If the present trend continues, the relating hexagram shows a structure that could emerge, but ` +
    `this is a possible direction, not a forecast. What is already changing may lead there; what is ` +
    `stable may prevent it. The reading keeps the distinction between a likely continuation and a ` +
    `certain outcome.`;

  const obstaclesAndBlindSpots =
    `The main resistance is the pull to treat a partial signal as the whole picture. A likely ` +
    `misjudgment is rushing a decision before the unstable factors reveal themselves. Information ` +
    `you do not yet have — especially about others' actual constraints — may be the missing piece.`;

  const turningConditions =
    `Signs that support holding the current read: clearer information, calmer external pressure, and ` +
    `a stable response from the people involved. Signs that call for re-evaluation: a sudden change ` +
    `in a key condition, new information that contradicts the earlier picture, or a shift in your own ` +
    `capacity to act. No precise date is implied.`;

  const conditionalActionDirection =
    `Under current conditions it is generally more apt to observe and prepare than to force a move. ` +
    `Suitable now: gathering information, clarifying intentions, and small reversible steps. Less ` +
    `suitable now: irreversible commitments or final answers. Change the orientation only when the ` +
    `turning conditions above actually appear — this reading does not command specific life decisions.`;

  const uncertaintyAndBoundaries =
    `This reading works from the situation you described and the pattern of ${name}; it is not a ` +
    `substitute for professional advice on medical, legal, financial, or safety matters. Several ` +
    `real-world variables could change the picture, and trend is not the same as fact. The useful ` +
    `output is perspective, not a directive.`;

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
    interpretiveBasisReferences: referencesFor(input.result),
  };
}
