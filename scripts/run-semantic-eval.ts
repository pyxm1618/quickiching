import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildHexagramResult } from "../src/domain/casting/hexagrams/compute";
import type { DeterministicFacts } from "../src/domain/generation/schemas";
import {
  validateDeepReadingEvidence,
  type DeepReadingContextEnrichment,
  type DeepReadingReport,
} from "../src/domain/generation/deep-reading-contract";
import { buildDeepReadingKnowledgeBundle } from "../src/server/generation/deep-reading-knowledge";
import {
  createAiSdkDeepReadingProvider,
  createAiSdkOutputReviewer,
} from "../src/server/generation/ai-sdk-provider";
import type { OutputReviewDecision } from "../src/server/generation/types";

// Load configuration from .env.staging.tmp
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.staging.tmp");
  const content = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = { ...process.env as Record<string, string> };
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
  }
  env.AI_ADAPTER_MODE = "ai-sdk";
  env.AI_GATEWAY_BASE_URL = "https://api.deepseek.com/v1";
  env.AI_SDK_GATEWAY_BASE_URL = "https://api.deepseek.com/v1";
  env.AI_MODEL_DEEP_READING = "deepseek-chat";
  env.AI_MODEL_OUTPUT_REVIEW = "deepseek-chat";
  env.AI_MAX_OUTPUT_TOKENS = "8000";
  env.AI_MAX_REVIEW_OUTPUT_TOKENS = "4000";
  if (process.env.EVAL_KEY) {
    env.AI_GATEWAY_API_KEY = process.env.EVAL_KEY.trim();
  }
  return env;
}

function makeFacts(lines: [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9]): DeterministicFacts {
  const result = buildHexagramResult({ lineValuesBottomUp: lines, method: "three_coin", algorithmVersion: "three-coin-v1" });
  const variant = result.movingLinePositions.length === 0
    ? "still_hexagram"
    : result.movingLinePositions.length === 6
      ? "all_lines_moving"
      : result.movingLinePositions.length > 1
        ? "multiple_moving"
        : "standard";
  return {
    method: "three_coin",
    algorithmVersion: result.algorithmVersion,
    classicMappingVersion: result.classicMappingVersion,
    lineValuesBottomUp: [...result.lineValuesBottomUp] as DeterministicFacts["lineValuesBottomUp"],
    primaryHexagramNumber: result.primaryHexagramNumber,
    movingLinePositions: [...result.movingLinePositions],
    relatingHexagramNumber: result.relatingHexagramNumber,
    readingVariant: variant,
  };
}

export type TestCase = {
  id: string;
  name: string;
  lines: [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9];
  question: string;
  context: DeepReadingContextEnrichment;
  scene?: "general" | "career" | "relationships" | "decision";
};

const CASES: TestCase[] = [
  {
    id: "case-1-still",
    name: "Case 1 — 无动爻 (Still Hexagram)",
    lines: [7, 7, 7, 7, 7, 7], // 乾卦，静卦
    question: "Should I initiate a major career pivot to start my own consulting business this quarter?",
    context: {
      contextNotes: "I have 10 years of experience in corporate management and built savings for 12 months of runway. No active business partner yet.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "what_do_i_need_to_see_clearly",
      locale: "en",
    },
  },
  {
    id: "case-2-single-moving",
    name: "Case 2 — 单动爻 (Single Moving Line)",
    lines: [7, 9, 7, 7, 7, 7], // 乾卦九二变，之同人
    question: "Should I reach out to a former senior mentor for strategic guidance on my new project?",
    context: {
      contextNotes: "I drafted the project outline and market research. The mentor is well-connected but very busy, and we haven't spoken in 18 months.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "how_should_i_act",
      locale: "en",
    },
  },
  {
    id: "case-3-multiple-moving",
    name: "Case 3 — 多动爻 (Multiple Moving Lines)",
    lines: [7, 9, 7, 9, 7, 7], // 乾卦九二、九四变，之家人
    question: "We have two competing strategic priorities: expand our sales team now or focus entirely on product stability?",
    context: {
      contextNotes: "Our runway is 14 months. Customers complain of software bugs, but competitors are aggressively pitching our prospective leads.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "what_should_i_pay_attention_to_next",
      locale: "en",
    },
  },
  {
    id: "case-4-all-lines-moving",
    name: "Case 4 — 六爻皆变 (All Lines Moving)",
    lines: [9, 9, 9, 9, 9, 9], // 乾卦六爻皆变，之坤卦
    question: "How should our organization navigate a sudden complete restructuring where the leadership team has been replaced?",
    context: {
      contextNotes: "A new board stepped in yesterday. All existing departmental roadmaps have been suspended, and direct managers are waiting for top-down instructions.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "what_is_the_likely_direction",
      locale: "en",
    },
  },
  {
    id: "case-5a-same-cast-job",
    name: "Case 5A — 同卦异问之工作 (Hexagram 32 line 4 -> 46)",
    lines: [7, 7, 8, 9, 7, 7], // 恒卦九四变，之升卦
    question: "Should I accept an unexpected job offer from a competing firm with 30% higher compensation?",
    context: {
      contextNotes: "I have been in my current role for 4 years. The current work is predictable and secure, but growth has completely stagnated.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "what_do_i_need_to_see_clearly",
      locale: "en",
    },
  },
  {
    id: "case-5b-same-cast-relationship",
    name: "Case 5B — 同卦异问之感情 (Hexagram 32 line 4 -> 46)",
    lines: [7, 7, 8, 9, 7, 7], // 恒卦九四变，之升卦
    question: "How should I handle the growing emotional distance with my long-term partner?",
    context: {
      contextNotes: "We have been together for 5 years. Recently conversations have become purely logistical, and quality time together has dropped noticeably.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "what_do_i_need_to_see_clearly",
      locale: "en",
    },
  },
  {
    id: "case-6a-same-question-kan",
    name: "Case 6A — 同问异卦之坎卦 (Hexagram 29 Still)",
    lines: [8, 7, 7, 8, 7, 7], // 坎卦静卦
    question: "How should I handle being assigned to lead a high-stakes, under-resourced internal project?",
    context: {
      contextNotes: "My team lacks senior engineering headcount, deadline is in 60 days, and upper management visibility is very high.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "how_should_i_act",
      locale: "en",
    },
  },
  {
    id: "case-6b-same-question-dayou",
    name: "Case 6B — 同问异卦之大有卦 (Hexagram 14 Still)",
    lines: [7, 7, 7, 7, 8, 7], // 大有卦静卦
    question: "How should I handle being assigned to lead a high-stakes, under-resourced internal project?",
    context: {
      contextNotes: "My team lacks senior engineering headcount, deadline is in 60 days, and upper management visibility is very high.",
      options: [],
      constraints: [],
      concerns: [],
      interpretationGoal: "how_should_i_act",
      locale: "en",
    },
  },
  {
    id: "case-7-zh-complex",
    name: "Case 7 — 中文复杂现实背景 (Hexagram 47 line 2 -> 45)",
    lines: [7, 9, 8, 7, 8, 7], // 困卦九二变，之萃卦
    question: "公司组织架构调整，我是否应该主动申请调去新成立的跨部门创新团队？",
    context: {
      contextNotes: "我目前在老团队已工作三年，熟悉流程但已无上升通道。新团队直接向副总裁汇报，机遇大但政治阻力也不小。",
      options: ["留在老团队维持现状", "正式提交转组申请", "先私下与新团队负责人喝咖啡摸底"],
      constraints: ["老部门领导下周开始做年度绩效盘点，一旦提交申请可能影响年终奖金"],
      concerns: ["新团队业务未定型，如果半年内没有产出可能面临被裁撤风险"],
      interpretationGoal: "how_should_i_act",
      locale: "zh-Hans",
    },
  },
  {
    id: "case-8-en-complex",
    name: "Case 8 — 英文复杂现实背景 (Hexagram 60 line 4 -> 19)",
    lines: [8, 8, 7, 9, 7, 8], // 节卦六四变，之临卦
    question: "Should we launch our SaaS platform in the European market next month despite incomplete GDPR documentation?",
    context: {
      contextNotes: "We have 15 inbound pilot customers ready in Germany and France. Engineering has implemented data encryption, but legal counsel has not signed off on the cross-border transfer agreements.",
      options: ["Launch on schedule under beta disclaimer", "Delay launch by 6 weeks for full legal sign-off", "Roll out only to UK pilot users first"],
      constraints: ["Competitor announced their EU launch for mid-next month", "Marketing budget for Q4 expires if unspent"],
      concerns: ["Regulatory fines or reputational damage from EU privacy watchdogs if investigated"],
      interpretationGoal: "what_should_i_pay_attention_to_next",
      locale: "en",
    },
  },
];

async function run() {
  const env = loadEnv();
  console.log("Loaded environment configuration for AI semantic evaluation.");
  console.log("Model Deep Reading:", env.AI_MODEL_DEEP_READING);
  console.log("Model Output Review:", env.AI_MODEL_OUTPUT_REVIEW);

  const provider = await createAiSdkDeepReadingProvider(env);
  const reviewer = await createAiSdkOutputReviewer(env);

  const results: Array<{
    caseId: string;
    name: string;
    question: string;
    context: DeepReadingContextEnrichment;
    facts: DeterministicFacts;
    evidenceIdsInBundle: string[];
    report: DeepReadingReport;
    evidenceValidation: { valid: boolean; invalidEvidenceIds: string[] };
    reviewDecision: OutputReviewDecision;
    tokenUsage: any;
    model: string;
    reviewerModel: string;
    timestamp: string;
  }> = [];

  const runNegativeOnly = process.argv.includes("--nc-only");

  if (!runNegativeOnly) {
    for (const testCase of CASES) {
    console.log(`\n=== Running ${testCase.name} ===`);
    const facts = makeFacts(testCase.lines);
    const knowledge = await buildDeepReadingKnowledgeBundle(facts);

    const input = {
      kind: "deep_reading" as const,
      castingId: `test_${testCase.id}`,
      question: testCase.question,
      context: testCase.context,
      scene: testCase.scene ?? "general",
      interpretationGoal: testCase.context.interpretationGoal,
      facts,
      knowledge,
      deadlineAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    console.log("Calling generation provider...");
    const abortController = new AbortController();
    const generationResult = await provider.generateReading(input as any, abortController.signal);
    const report = generationResult.output as DeepReadingReport;

    console.log("Validating evidence...");
    const evidenceValidation = validateDeepReadingEvidence(report, knowledge, {
      primaryHexagramNumber: facts.primaryHexagramNumber,
      relatingHexagramNumber: facts.relatingHexagramNumber,
      movingLinePositions: facts.movingLinePositions,
      readingVariant: facts.readingVariant,
    });
    console.log(`Evidence Valid: ${evidenceValidation.valid}`, evidenceValidation.invalidEvidenceIds);

    console.log("Calling output reviewer...");
    const reviewDecision = await reviewer.review({
      kind: "deep_reading",
      castingId: `test_${testCase.id}`,
      question: testCase.question,
      context: testCase.context,
      scene: testCase.scene ?? "general",
      interpretationGoal: testCase.context.interpretationGoal,
      facts,
      knowledge,
      output: report,
      deadlineAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    } as any, abortController.signal);
    console.log(`Reviewer Status: ${reviewDecision.status}`, reviewDecision.reasonCodes);

    results.push({
      caseId: testCase.id,
      name: testCase.name,
      question: testCase.question,
      context: testCase.context,
      facts,
      evidenceIdsInBundle: knowledge.evidence.map((e) => e.id),
      report,
      evidenceValidation,
      reviewDecision,
      tokenUsage: generationResult.tokenUsage,
      model: env.AI_MODEL_DEEP_READING ?? "deepseek-chat",
      reviewerModel: env.AI_MODEL_OUTPUT_REVIEW ?? "deepseek-chat",
      timestamp: new Date().toISOString(),
    });
  }

  const outputPath = resolve(process.cwd(), "scratch/semantic-eval-results.json");
  writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nAll evaluation runs complete. Results written to ${outputPath}`);
  }

  // ==========================================
  // Real Reviewer Negative Controls (3 Cases)
  // ==========================================
  console.log("\n==========================================");
  console.log("Running 3 Real Reviewer Negative Controls");
  console.log("==========================================");

  const negativeControls: Array<{
    controlId: string;
    description: string;
    expectedStatus: "fail";
    expectedFlagFalse: string;
    reviewDecision: OutputReviewDecision;
    statusPassedAsExpected: boolean;
  }> = [];

  // NC 1: 答非所问 (Off-topic)
  {
    console.log("\n=== Negative Control 1: Off-Topic (Job offer question -> Love conflict report) ===");
    const testCase = CASES.find((c) => c.id === "case-5a-same-cast-job")!;
    const facts = makeFacts(testCase.lines);
    const knowledge = await buildDeepReadingKnowledgeBundle(facts);
    const offTopicReport: DeepReadingReport = {
      schemaVersion: "deep-reading-v2",
      readingVariant: facts.readingVariant,
      directAnswer: "This cast indicates severe tension in your romantic relationship and family home. While you are asking about emotional reconciliation with your partner, the cast shows that unresolved conflict from the past is poisoning your domestic peace and you need to tread very carefully around your spouse's anger.",
      situationMapping: "Your romantic relationship of five years is under immense pressure because of domestic chores and lack of mutual communication. The Lake trigram underneath Heaven shows you tread on your lover's sensitivity without knowing it.",
      keyTensions: [
        "Emotional distance between romantic partners",
        "Domestic arguments over household spending versus personal time",
      ],
      conditionalDirection: "If you can have an open date night with your partner and listen without becoming defensive, the romantic intimacy may slowly recover; if you continue working late, divorce is inevitable.",
      signalsToWatch: [
        "Whether your spouse initiates physical affection",
        "Whether domestic dinner conversations can proceed without hostile silence",
      ],
      practicalReflection: "Have an honest talk with your partner tonight about domestic chores before touching anything related to work.",
      uncertaintyAndBoundaries: "The reading does not predict whether your partner will file for divorce tomorrow.",
      interpretiveBasisReferences: [
        { evidenceId: "primary.judgment" },
        { evidenceId: "primary.core_meaning" },
      ],
      disclaimer: "Reflective interpretation only.",
    };

    const abortController = new AbortController();
    const reviewDecision = await reviewer.review({
      kind: "deep_reading",
      castingId: "nc_off_topic",
      question: testCase.question,
      context: testCase.context,
      scene: "career",
      interpretationGoal: testCase.context.interpretationGoal,
      facts,
      knowledge,
      output: offTopicReport,
      deadlineAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    } as any, abortController.signal);

    console.log(`NC 1 Reviewer Status: ${reviewDecision.status}`, reviewDecision.reasonCodes);
    console.log(`NC 1 questionRelevancePass: ${(reviewDecision as any).questionRelevancePass}`);
    negativeControls.push({
      controlId: "nc-1-off-topic",
      description: "Candidate report discusses romantic marriage conflict when question asks about job offer",
      expectedStatus: "fail",
      expectedFlagFalse: "questionRelevancePass",
      reviewDecision,
      statusPassedAsExpected: reviewDecision.status === "fail" && (reviewDecision as any).questionRelevancePass === false,
    });
  }

  // NC 2: 编造用户事实 (Invented user facts)
  {
    console.log("\n=== Negative Control 2: Invented Facts (Hallucinated $20k signed clients & VP promise) ===");
    const testCase = CASES.find((c) => c.id === "case-1-still")!;
    const facts = makeFacts(testCase.lines);
    const knowledge = await buildDeepReadingKnowledgeBundle(facts);
    const inventedFactsReport: DeepReadingReport = {
      schemaVersion: "deep-reading-v2",
      readingVariant: facts.readingVariant,
      directAnswer: "Because your corporate manager has already explicitly promised you an executive promotion with equity grant next month, and because your three signed Fortune 500 corporate clients are already paying you $20,000 monthly retainer, you should immediately quit your day job.",
      situationMapping: "You already have three signed enterprise clients paying $20,000 monthly retainers and your current VP officially guaranteed your equity vesting before you leave.",
      keyTensions: [
        "Managing the $20,000 retainer from your first three clients versus corporate VP promise",
        "Hiring five direct reports with the new consulting revenue",
      ],
      conditionalDirection: "Since your clients already paid non-refundable deposits, your consulting firm is guaranteed to succeed immediately.",
      signalsToWatch: [
        "Wire transfer confirmations from the three signed corporate clients",
        "Written promotion agreement signed by your current corporate VP",
      ],
      practicalReflection: "Send invoices to your three existing corporate clients today.",
      uncertaintyAndBoundaries: "Based entirely on your verified signed client contracts and confirmed VP promotion offer.",
      interpretiveBasisReferences: [
        { evidenceId: "primary.judgment" },
        { evidenceId: "primary.core_meaning" },
      ],
      disclaimer: "Reflective interpretation only.",
    };

    const abortController = new AbortController();
    const reviewDecision = await reviewer.review({
      kind: "deep_reading",
      castingId: "nc_invented_facts",
      question: testCase.question,
      context: testCase.context,
      scene: "career",
      interpretationGoal: testCase.context.interpretationGoal,
      facts,
      knowledge,
      output: inventedFactsReport,
      deadlineAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    } as any, abortController.signal);

    console.log(`NC 2 Reviewer Status: ${reviewDecision.status}`, reviewDecision.reasonCodes);
    console.log(`NC 2 contextFidelityPass: ${(reviewDecision as any).contextFidelityPass}`);
    negativeControls.push({
      controlId: "nc-2-invented-facts",
      description: "Candidate report fabricates signed clients and VP promotion promises not in user context",
      expectedStatus: "fail",
      expectedFlagFalse: "contextFidelityPass",
      reviewDecision,
      statusPassedAsExpected: reviewDecision.status === "fail" && (reviewDecision as any).contextFidelityPass === false,
    });
  }

  // NC 3: 结论与 Evidence 毫无逻辑关系 (Unsupported conclusion)
  {
    console.log("\n=== Negative Control 3: Unsupported Evidence (Qian hexagram claims stock crash & desert dragons) ===");
    const testCase = CASES.find((c) => c.id === "case-1-still")!;
    const facts = makeFacts(testCase.lines);
    const knowledge = await buildDeepReadingKnowledgeBundle(facts);
    const unsupportedReport: DeepReadingReport = {
      schemaVersion: "deep-reading-v2",
      readingVariant: facts.readingVariant,
      directAnswer: "Because the Judgment of Qian states 元亨利贞 and the core meaning is initiative, this directly proves that the entire global financial market will crash next week and you are commanded by the hexagram to liquidate all your assets, purchase gold bullion immediately, and avoid speaking to anyone for 12 months.",
      situationMapping: "The judgment '元亨利贞' structurally proves that your industry is doomed and that you must cease all corporate work to hide underground. The dragons mentioned in Qian mean you will literally meet ancient mystical creatures in the desert.",
      keyTensions: [
        "Buying gold bullion versus hiding in a desert cave",
        "Protecting your family from global economic collapse mandated by Qian",
      ],
      conditionalDirection: "If the market crashes as the Qian judgment demands, hide in the desert; if you stay in the city, the dragons of Qian will punish you.",
      signalsToWatch: [
        "Sightings of flying mystical dragons in the sky over your city",
        "Immediate collapse of all banking institutions",
      ],
      practicalReflection: "Liquidate your savings into physical gold bullion immediately.",
      uncertaintyAndBoundaries: "The cast commands immediate liquidation and cannot be questioned.",
      interpretiveBasisReferences: [
        { evidenceId: "primary.judgment" },
        { evidenceId: "primary.core_meaning" },
      ],
      disclaimer: "Reflective interpretation only.",
    };

    const abortController = new AbortController();
    const reviewDecision = await reviewer.review({
      kind: "deep_reading",
      castingId: "nc_unsupported_evidence",
      question: testCase.question,
      context: testCase.context,
      scene: "career",
      interpretationGoal: testCase.context.interpretationGoal,
      facts,
      knowledge,
      output: unsupportedReport,
      deadlineAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    } as any, abortController.signal);

    console.log(`NC 3 Reviewer Status: ${reviewDecision.status}`, reviewDecision.reasonCodes);
    console.log(`NC 3 evidenceGroundingPass: ${(reviewDecision as any).evidenceGroundingPass}`);
    console.log(`NC 3 interpretiveCoherencePass: ${(reviewDecision as any).interpretiveCoherencePass}`);
    negativeControls.push({
      controlId: "nc-3-unsupported-evidence",
      description: "Candidate report claims global crash and desert dragons derived from Qian judgment evidence",
      expectedStatus: "fail",
      expectedFlagFalse: "evidenceGroundingPass or interpretiveCoherencePass",
      reviewDecision,
      statusPassedAsExpected: reviewDecision.status === "fail" && ((reviewDecision as any).evidenceGroundingPass === false || (reviewDecision as any).interpretiveCoherencePass === false),
    });
  }

  const ncOutputPath = resolve(process.cwd(), "scratch/reviewer-negative-controls.json");
  writeFileSync(ncOutputPath, JSON.stringify(negativeControls, null, 2), "utf-8");
  console.log(`\nReviewer negative controls complete. Results written to ${ncOutputPath}`);
}

run().catch((error) => {
  console.error("Semantic evaluation failed:", error);
  process.exit(1);
});
