import type { ContentLocale } from "@/i18n/config";
import type { HexagramResult, InterpretationGoal, Scene } from "@/domain/casting/types";
import { hexagramByNumber, type Trigram } from "@/domain/casting/hexagrams/king-wen";
import {
  assembleReadingReport,
  readingVariantFor,
} from "@/domain/generation/assemble-report";
import type {
  CommercialReadingReportV2,
  GeneratedReading,
  VerdictEcho,
} from "@/domain/generation/schemas";
import {
  buildDeterministicVerdict,
  type DeterministicVerdict,
} from "@/domain/interpretation/deterministic/verdict";
import {
  describeChangeRule,
  describeDirection,
  describePosition,
  describeRelation,
  describeTrigram,
} from "@/domain/interpretation/deterministic/localize";
import { TRIGRAM_ATTRIBUTES } from "@/domain/interpretation/deterministic/trigrams";
import type { LinePolarity } from "@/domain/interpretation/deterministic/line-position";
import { hasProhibitedPhrasing, questionKeyTerms } from "@/server/generation/reading-validator";
import type { PreviewOutput } from "@/domain/readings/types";

// Deterministic offline generator used when AI_ADAPTER_MODE=local (the default
// for local development). It stands in for the reviewed AI SDK pipeline, and its
// prose quality is deliberately not that of model output.
//
// What it does guarantee is shape and provenance: the deep reading is assembled
// through the same commercial-reading-v2 assembler the production workflow uses,
// its deterministic half comes from buildDeterministicVerdict, and its written
// half satisfies src/server/generation/reading-validator. A developer running
// offline therefore sees the structure production will persist, rather than a
// second format that only exists locally.

const SCENE_LABEL: Record<ContentLocale, Record<Scene, string>> = {
  en: {
    career: "your work and direction",
    relationships: "your relationships",
    wealth: "your resources and finances",
    timing: "whether the timing is right",
    choices: "a decision you face",
    personal_growth: "your own development",
    other: "what you brought to the reading",
  },
  "zh-Hans": {
    career: "工作与方向",
    relationships: "人际关系",
    wealth: "资源与财务",
    timing: "时机是否合适",
    choices: "面前的一个决定",
    personal_growth: "自身的成长",
    other: "你带来的这件事",
  },
};

const GOAL_LABEL: Record<ContentLocale, Record<InterpretationGoal, string>> = {
  en: {
    what_do_i_need_to_see_clearly: "see the present situation clearly",
    what_is_blocking_this_situation: "find what is holding this up",
    what_should_i_understand_about_my_options: "understand the options on the table",
    what_should_i_pay_attention_to_next: "know what to watch next",
    is_the_timing_favorable: "judge whether the timing suits",
  },
  "zh-Hans": {
    what_do_i_need_to_see_clearly: "看清眼下的关键",
    what_is_blocking_this_situation: "找出卡住这件事的地方",
    what_should_i_understand_about_my_options: "理解手上的选项",
    what_should_i_pay_attention_to_next: "知道接下来该留意什么",
    is_the_timing_favorable: "判断时机是否合适",
  },
};

// How the decided direction is carried into the guidance module. Always
// conditional: the offline adapter is held to the same phrasing rule as the
// model, so its guidance passes the same check.
const DIRECTION_GUIDANCE: Record<ContentLocale, Record<VerdictEcho, string>> = {
  "zh-Hans": {
    favorable: "可以顺势推进，把力气放在承接上",
    flowing: "按现有节奏走即可，不必额外加码",
    workable: "推进得动，但要预留气力与时间",
    draining: "先收一收投入，把消耗算清楚再谈推进",
    obstructed: "宜守不宜攻，先避开正面",
    undetermined: "本次没有方向可依，只做可逆的小步",
  },
  en: {
    favorable: "you can move with it and put your effort into receiving what comes",
    flowing: "the current pace is enough and no extra push is needed",
    workable: "it can be moved, but budget the effort and the time",
    draining: "pull the spending back and account for the drain before pushing on",
    obstructed: "hold rather than advance, and go around the front",
    undetermined: "this cast gives no direction, so keep to small reversible steps",
  },
};

type StageKey = "still" | "few" | "many" | "whole";

const STAGE_TEXT: Record<ContentLocale, Record<StageKey, string>> = {
  "zh-Hans": {
    still: "结构稳定、尚未起变化的阶段",
    few: "少数环节开始松动的阶段",
    many: "多处同时变动、结构正在重排的阶段",
    whole: "整体转换的阶段",
  },
  en: {
    still: "a holding phase, with the structure not yet in motion",
    few: "a phase in which a few points have begun to loosen",
    many: "a phase in which several points move at once and the structure is rearranging",
    whole: "a phase of wholesale transition",
  },
};

const POLARITY_TEXT: Record<ContentLocale, Record<LinePolarity, string>> = {
  "zh-Hans": { yang: "阳", yin: "阴" },
  en: { yang: "yang", yin: "yin" },
};

const TOPIC_SEPARATOR: Record<ContentLocale, string> = { "zh-Hans": "、", en: ", " };

const FALLBACK_TOPIC: Record<ContentLocale, string> = {
  "zh-Hans": "你在问题里描述的那件事",
  en: "the situation you described",
};

// The question's own words are listed once, in the restatement. Later modules
// point back at that list rather than repeating it, which would read as keyword
// stuffing rather than as engagement with the question.
const TOPICS_BACKREF: Record<ContentLocale, string> = {
  "zh-Hans": "上面这些着眼点",
  en: "the terms named above",
};

const THE_MATTER: Record<ContentLocale, string> = {
  "zh-Hans": "所问之事",
  en: "the matter you asked about",
};

const MAX_TOPICS = 4;
const TOPIC_BUDGET_CHARS = 120;

// The same runs reading-validator derives its question terms from.
const CJK_RUN = /[一-鿿]{2,}/g;
const LATIN_WORD = /[A-Za-z][A-Za-z'-]{3,}/g;

/**
 * The reader's own words, ready to be named back to them.
 *
 * The validator asks a reading to engage with the question, and the offline
 * adapter has no model to do that, so it names the question's own runs. Those
 * runs are exactly what the term extractor works from, which is why naming one
 * satisfies the specificity check. They are never bracketed: quotation brackets
 * are reserved for classical text.
 *
 * A run carrying banned phrasing is dropped whole and the shorter extracted
 * terms are tried instead, since a sub-term can be safe where the run around it
 * is not. Fragments are joined with a separator so two safe pieces cannot abut
 * into a banned phrase. A question whose every extracted term is banned would
 * leave nothing to name — the fallback keeps the module readable and lets the
 * validator reject it, which is the honest outcome.
 */
function questionTopics(question: string, locale: ContentLocale): string {
  const runs = [...(question.match(CJK_RUN) ?? []), ...(question.match(LATIN_WORD) ?? [])];
  const safeRuns = runs.filter((run) => !hasProhibitedPhrasing(run));
  const source = safeRuns.length > 0
    ? safeRuns
    : questionKeyTerms(question).filter((term) => !hasProhibitedPhrasing(term));

  const picked: string[] = [];
  let budget = TOPIC_BUDGET_CHARS;
  for (const fragment of source) {
    if (picked.length >= MAX_TOPICS) break;
    if (fragment.length > budget || picked.includes(fragment)) continue;
    picked.push(fragment);
    budget -= fragment.length;
  }

  return picked.length > 0 ? picked.join(TOPIC_SEPARATOR[locale]) : FALLBACK_TOPIC[locale];
}

function stageKey(movingCount: number): StageKey {
  if (movingCount === 0) return "still";
  if (movingCount === 6) return "whole";
  if (movingCount >= 3) return "many";
  return "few";
}

type NamedHexagram = { number: number; chineseName: string };

type ReadingParts = {
  topics: string;
  topicsRef: string;
  matter: string;
  scene: string;
  goal: string;
  rule: string;
  movingClause: string;
  stage: string;
  primary: NamedHexagram;
  relating: NamedHexagram | null;
  nuclear: NamedHexagram;
  inner: { chineseName: string; image: string; quality: string };
  outer: { chineseName: string; image: string; quality: string };
  tiYong: { ti: string; yong: string; relation: string } | null;
  // Why no direction, when tiYong is null. The engine returns null for two
  // different reasons and they are not interchangeable to a reader.
  tiYongAbsence: string;
  direction: string | null;
  guidance: string;
  quote: { label: string; text: string };
  supporting: { label: string; text: string }[];
  movingLines: { position: number; polarity: string; imagery: string }[];
  weakPoints: string[];
};

function weakPointsFor(verdict: DeterministicVerdict, locale: ContentLocale): string[] {
  const points: string[] = [];
  for (const line of verdict.movingLines) {
    if (!line.correctPlace) {
      points.push(locale === "zh-Hans"
        ? `第 ${line.position} 爻失位`
        : `line ${line.position} is out of place`);
    }
    if (!line.correspondence.responding) {
      points.push(locale === "zh-Hans"
        ? `第 ${line.position} 爻与第 ${line.correspondence.position} 爻不相应`
        : `line ${line.position} finds no response at line ${line.correspondence.position}`);
    }
    if (line.ridesYang) {
      points.push(locale === "zh-Hans"
        ? `第 ${line.position} 爻乘刚`
        : `line ${line.position} rides a yang line`);
    }
  }
  return points;
}

// analyzeTiYong returns null both when nothing moves and when the moving lines
// span both trigrams. Same absent direction, different classical reason.
function tiYongAbsence(movingCount: number, locale: ContentLocale): string {
  if (locale === "zh-Hans") {
    return movingCount === 0
      ? "六爻皆静，无动爻可定体用，本次不给方向，只讲结构。"
      : "动爻分处上下两卦，体用不成立，本次不给方向，只讲结构。";
  }
  return movingCount === 0
    ? "No line moves, so there is no 用 to set against 体: this cast gives no direction,"
      + " only structure."
    : "The moving lines fall in both trigrams, so Ti-Yong does not apply: this cast gives no"
      + " direction, only structure.";
}

function movingClause(movingCount: number, locale: ContentLocale): string {
  if (locale === "zh-Hans") {
    return movingCount === 0 ? "六爻皆静" : `六爻中有 ${movingCount} 爻变动`;
  }
  if (movingCount === 0) return "No line moves";
  if (movingCount === 1) return "One of the six lines moves";
  return `${movingCount} of the six lines move`;
}

// 体 and 用 are reported by trigram identifier in the engine. The reading names
// them the way a reader can recognise instead.
function trigramLabel(trigram: Trigram, locale: ContentLocale): string {
  const chineseName = TRIGRAM_ATTRIBUTES[trigram].chineseName;
  if (locale === "zh-Hans") return chineseName;
  return `${chineseName} (${describeTrigram(trigram, locale).image})`;
}

function buildParts(input: {
  verdict: DeterministicVerdict;
  scene: Scene;
  goal: InterpretationGoal;
  question: string;
  locale: ContentLocale;
}): ReadingParts {
  const { verdict, locale } = input;
  const inner = describeTrigram(verdict.trigrams.inner.trigram, locale);
  const outer = describeTrigram(verdict.trigrams.outer.trigram, locale);
  const echo: VerdictEcho = verdict.direction ?? "undetermined";

  return {
    topics: questionTopics(input.question, locale),
    topicsRef: TOPICS_BACKREF[locale],
    matter: THE_MATTER[locale],
    scene: SCENE_LABEL[locale][input.scene],
    goal: GOAL_LABEL[locale][input.goal],
    rule: describeChangeRule(verdict.changeRule.ruleId, locale),
    movingClause: movingClause(verdict.changeRule.movingCount, locale),
    stage: STAGE_TEXT[locale][stageKey(verdict.changeRule.movingCount)],
    primary: verdict.primaryHexagram,
    relating: verdict.relatingHexagram,
    nuclear: verdict.nuclearHexagram,
    inner: { chineseName: verdict.trigrams.inner.chineseName, ...inner },
    outer: { chineseName: verdict.trigrams.outer.chineseName, ...outer },
    tiYong: verdict.tiYong
      ? {
          ti: trigramLabel(verdict.tiYong.ti.trigram, locale),
          yong: trigramLabel(verdict.tiYong.yong.trigram, locale),
          relation: describeRelation(verdict.tiYong.relation, locale),
        }
      : null,
    tiYongAbsence: tiYongAbsence(verdict.changeRule.movingCount, locale),
    direction: verdict.direction === null ? null : describeDirection(verdict.direction, locale),
    guidance: DIRECTION_GUIDANCE[locale][echo],
    quote: { label: verdict.oracle.primary.label, text: verdict.oracle.primary.text },
    supporting: verdict.oracle.supporting.map((quote) => ({ label: quote.label, text: quote.text })),
    movingLines: verdict.movingLines.map((line) => ({
      position: line.position,
      polarity: POLARITY_TEXT[locale][line.polarity],
      imagery: describePosition(line.position, locale),
    })),
    weakPoints: weakPointsFor(verdict, locale),
  };
}

// Written modules, per locale. Only the classical text ever sits inside
// quotation brackets, so the fabricated-quote check passes; the guidance module
// always carries its locale's conditional marker.
type ModuleWriter = (parts: ReadingParts) => Omit<GeneratedReading, "verdictEcho">;

// A still hexagram has no moving line to call weak, and a sound structure has
// none either; both still owe the reader something to check.
function zhObstacles(parts: ReadingParts): string {
  if (parts.movingLines.length === 0) {
    return `六爻皆静，没有动爻可指薄弱处；要留意的是${parts.topicsRef}的信息是否已经确认。`;
  }
  if (parts.weakPoints.length > 0) {
    return `结构上的薄弱处：${parts.weakPoints.join("、")}。`
      + `这几处是${parts.matter}上最容易先出问题的地方。`;
  }
  return "本次动爻当位得应，结构上没有明显薄弱处；"
    + `要留意的反而是${parts.topicsRef}的信息是否已经确认。`;
}

function enObstacles(parts: ReadingParts): string {
  if (parts.movingLines.length === 0) {
    return "No line moves, so there is no moving line to mark as weak; what needs checking is"
      + ` whether the facts behind ${parts.topicsRef} are confirmed.`;
  }
  if (parts.weakPoints.length > 0) {
    return `Weak points in the structure: ${parts.weakPoints.join("; ")}.`
      + ` Those are where ${parts.matter} is likeliest to give first.`;
  }
  return "The moving lines are correctly placed and answered, so the structure shows no obvious"
    + ` weak point; what needs checking instead is whether the facts behind ${parts.topicsRef}`
    + " are confirmed.";
}

const WRITE_MODULES: Record<ContentLocale, ModuleWriter> = {
  "zh-Hans": (parts) => ({
    questionRestatement:
      `你这次问的是${parts.scene}，想${parts.goal}。问题里的着眼点是：${parts.topics}。`,
    oracleApplication:
      `${parts.rule}，故本次以${parts.quote.label}为主断：「${parts.quote.text}」`
      + (parts.supporting.length > 0
        ? `辅助原文取${parts.supporting.map((s) => `${s.label}：「${s.text}」`).join("")}`
        : "")
      + `这段原文是本次解读唯一的引用来源，${parts.matter}的分寸照它来看。`,
    currentStage:
      `${parts.movingClause}，属${parts.stage}。`
      + `就${parts.scene}而言，这是本次断例给出的位置，不是对结果的预告。`,
    structuralReading:
      `内卦${parts.inner.chineseName}（${parts.inner.image}，其德为${parts.inner.quality}），`
      + `外卦${parts.outer.chineseName}（${parts.outer.image}，其德为${parts.outer.quality}），`
      + `互卦为第 ${parts.nuclear.number} 卦${parts.nuclear.chineseName}，是这件事的过程。`
      + (parts.tiYong
        ? `体为${parts.tiYong.ti}、用为${parts.tiYong.yong}，二者${parts.tiYong.relation}，`
          + `方向因此定为：${parts.direction}。`
        : parts.tiYongAbsence),
    changeMechanism:
      (parts.movingLines.length > 0
        ? `变动落在${parts.movingLines
            .map((line) => `第 ${line.position} 爻（${line.polarity}，${line.imagery}）`)
            .join("、")}。`
        : "六爻皆静，卦内不自生变化。")
      + (parts.relating
        ? `本卦${parts.primary.chineseName}由此转为之卦第 ${parts.relating.number} 卦`
          + `${parts.relating.chineseName}，这是变化的去处。`
        : "没有之卦，变化更多来自外部条件而不是卦内。"),
    obstacles: zhObstacles(parts),
    turningConditions:
      `若${parts.topicsRef}出现新的确定信息，或上述结构对应的条件发生变化，`
      + "就该重新看一遍这个断例。本次不含任何具体日期。",
    conditionalGuidance:
      `若上述条件成立，则${parts.guidance}；若条件尚未成立，则先补齐信息，只做可逆的小步。`
      + "本条由离线适配器按规则生成，不构成医疗、法律、财务或安全方面的专业意见。",
    uncertaintyAndBoundaries:
      "这份解读由离线适配器按确定性规则拼出，用于本地开发与形状校验，不是经过评估的模型产出。"
      + "它给的是视角而不是结论，也不替代你自己的判断与专业咨询。",
  }),

  en: (parts) => ({
    questionRestatement:
      `You are asking about ${parts.scene}, and you want to ${parts.goal}.`
      + ` The terms this reading works from in your question: ${parts.topics}.`,
    oracleApplication:
      `${parts.rule}. The governing text is ${parts.quote.label}: 「${parts.quote.text}」`
      + (parts.supporting.length > 0
        ? ` Supporting text: ${parts.supporting
            .map((s) => `${s.label}: 「${s.text}」`)
            .join(" ")}`
        : "")
      + ` That is the only text this reading may cite, and it sets the measure for ${parts.matter}.`
      + " The offline adapter quotes the classical Chinese without an English gloss;"
      + " the reviewed pipeline supplies one.",
    currentStage:
      `${parts.movingClause}, so this is ${parts.stage}.`
      + ` For ${parts.scene}, that is where the cast places you now — not a forecast of how it ends.`,
    structuralReading:
      `Inner trigram ${parts.inner.chineseName} (${parts.inner.image}, ${parts.inner.quality});`
      + ` outer trigram ${parts.outer.chineseName} (${parts.outer.image}, ${parts.outer.quality}).`
      + ` The nuclear hexagram is ${parts.nuclear.number} ${parts.nuclear.chineseName},`
      + " which stands for the process."
      + (parts.tiYong
        ? ` 体 is ${parts.tiYong.ti} and 用 is ${parts.tiYong.yong}: ${parts.tiYong.relation},`
          + ` which fixes the direction — ${parts.direction}.`
        : ` ${parts.tiYongAbsence}`),
    changeMechanism:
      (parts.movingLines.length > 0
        ? `The movement falls on ${parts.movingLines
            .map((line) => `line ${line.position} (${line.polarity} — ${line.imagery})`)
            .join(", ")}.`
        : "No line moves, so the hexagram generates no change of its own.")
      + (parts.relating
        ? ` ${parts.primary.chineseName} therefore turns into the relating hexagram`
          + ` ${parts.relating.number} ${parts.relating.chineseName}, which is where the change is headed.`
        : " There is no relating hexagram, so change would come from outside conditions"
          + " rather than from within the cast."),
    obstacles: enObstacles(parts),
    turningConditions:
      `If newly confirmed information appears around ${parts.topicsRef}, or a condition behind the`
      + " structure above changes, this cast is worth reading again. No date is implied.",
    conditionalGuidance:
      `If the conditions above hold, then ${parts.guidance}; if they do not yet hold,`
      + " fill in the missing facts first and keep to reversible steps."
      + " This is offline adapter output generated by rule, and it is not medical, legal,"
      + " financial or safety advice.",
    uncertaintyAndBoundaries:
      "This reading was assembled offline by deterministic rule for local development and shape"
      + " checking; it is not reviewed model output. It offers perspective rather than a"
      + " conclusion, and does not replace your own judgment or professional advice.",
  }),
};

export function generateLocalPreview(input: {
  result: HexagramResult;
  scene: Scene;
  context: string;
}): PreviewOutput {
  const name = hexagramByNumber(input.result.primaryHexagramNumber).englishName;
  // The preview is not part of the v2 deep-reading migration and stays English.
  const sceneLabel = SCENE_LABEL.en[input.scene];
  // 25-55 words, max 2 sentences, only surface tension + surface relevance.
  // Must NOT reveal stage, trend, turning conditions, or action orientation (RESULT-002).
  const statement =
    `Your question about ${sceneLabel} and the imagery of ${name} both turn on a quiet tension ` +
    `between what feels settled and what is still moving. The pattern echoes the situation you ` +
    `described without telling you what must happen next.`;
  return { relevanceStatement: statement };
}

/**
 * Offline deep reading in the commercial-reading-v2 shape.
 *
 * @param context the reader's question; the written half is checked against it.
 */
export function generateLocalReading(input: {
  result: HexagramResult;
  scene: Scene;
  goal: InterpretationGoal;
  context: string;
  locale: ContentLocale;
}): CommercialReadingReportV2 {
  const verdict = buildDeterministicVerdict(input.result);
  const parts = buildParts({
    verdict,
    scene: input.scene,
    goal: input.goal,
    question: input.context,
    locale: input.locale,
  });

  const generated: GeneratedReading = {
    // The direction is decided by classical rule; the offline writer echoes it
    // for exactly the same reason a model must.
    verdictEcho: verdict.direction ?? "undetermined",
    ...WRITE_MODULES[input.locale](parts),
  };

  return assembleReadingReport({
    verdict,
    generated,
    readingVariant: readingVariantFor(input.result.movingLinePositions),
    locale: input.locale,
  });
}
