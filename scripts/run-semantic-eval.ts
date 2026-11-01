import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHexagramResult } from "../src/domain/casting/hexagrams/compute";
import type { DeterministicFacts } from "../src/domain/generation/schemas";
import {
  validateDeepReadingEvidence,
  type DeepReadingReport,
} from "../src/domain/generation/deep-reading-contract";
import { buildDeepReadingKnowledgeBundle } from "../src/server/generation/deep-reading-knowledge";
import {
  createAiSdkDeepReadingProvider,
  createAiSdkOutputReviewer,
} from "../src/server/generation/ai-sdk-provider";
import type { OutputReviewDecision } from "../src/server/generation/types";

// Load configuration from .env.staging.tmp
export function loadSemanticEvalEnv(envPath: string, processEnv: Record<string, string | undefined> = process.env) {
  const content = readFileSync(envPath, "utf-8");
  const env: Record<string, string | undefined> = { ...processEnv };
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
  if (processEnv.EVAL_KEY) env.AI_GATEWAY_API_KEY = processEnv.EVAL_KEY.trim();
  for (const name of ["AI_GATEWAY_API_KEY", "AI_MODEL_DEEP_READING", "AI_MODEL_OUTPUT_REVIEW"]) {
    if (!env[name]?.trim() || /^\[(?:SENSITIVE|REDACTED)\]$/iu.test(env[name]!.trim())) {
      throw new Error(`SEMANTIC_EVAL_SECRET_UNAVAILABLE: ${name}`);
    }
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
  locale: "en" | "zh-Hans";
  scene?: "general" | "career" | "relationships" | "decision";
};

const CASES: TestCase[] = [
  {
    id: "case-1-still",
    name: "Case 1 — 无动爻 (Still Hexagram)",
    lines: [7, 7, 7, 7, 7, 7], // 乾卦，静卦
    question: "Should I initiate a major career pivot to start my own consulting business this quarter?",
    locale: "en",
  },
  {
    id: "case-2-single-moving",
    name: "Case 2 — 单动爻 (Single Moving Line)",
    lines: [7, 9, 7, 7, 7, 7], // 乾卦九二变，之同人
    question: "Should I reach out to a former senior mentor for strategic guidance on my new project?",
    locale: "en",
  },
  {
    id: "case-3-multiple-moving",
    name: "Case 3 — 多动爻 (Multiple Moving Lines)",
    lines: [7, 9, 7, 9, 7, 7], // 乾卦九二、九四变，之家人
    question: "We have two competing strategic priorities: expand our sales team now or focus entirely on product stability?",
    locale: "en",
  },
  {
    id: "case-4-all-lines-moving",
    name: "Case 4 — 六爻皆变 (All Lines Moving)",
    lines: [9, 9, 9, 9, 9, 9], // 乾卦六爻皆变，之坤卦
    question: "How should our organization navigate a sudden complete restructuring where the leadership team has been replaced?",
    locale: "en",
  },
  {
    id: "case-5a-same-cast-job",
    name: "Case 5A — 同卦异问之工作 (Hexagram 32 line 4 -> 46)",
    lines: [7, 7, 8, 9, 7, 7], // 恒卦九四变，之升卦
    question: "Should I accept an unexpected job offer from a competing firm with 30% higher compensation?",
    locale: "en",
  },
  {
    id: "case-5b-same-cast-relationship",
    name: "Case 5B — 同卦异问之感情 (Hexagram 32 line 4 -> 46)",
    lines: [7, 7, 8, 9, 7, 7], // 恒卦九四变，之升卦
    question: "How should I handle the growing emotional distance with my long-term partner?",
    locale: "en",
  },
  {
    id: "case-6a-same-question-kan",
    name: "Case 6A — 同问异卦之坎卦 (Hexagram 29 Still)",
    lines: [8, 7, 7, 8, 7, 7], // 坎卦静卦
    question: "How should I handle being assigned to lead a high-stakes, under-resourced internal project?",
    locale: "en",
  },
  {
    id: "case-6b-same-question-dayou",
    name: "Case 6B — 同问异卦之大有卦 (Hexagram 14 Still)",
    lines: [7, 7, 7, 7, 8, 7], // 大有卦静卦
    question: "How should I handle being assigned to lead a high-stakes, under-resourced internal project?",
    locale: "en",
  },
  {
    id: "case-7-zh-complex",
    name: "Case 7 — 中文复杂现实背景 (Hexagram 47 line 2 -> 45)",
    lines: [7, 9, 8, 7, 8, 7], // 困卦九二变，之萃卦
    question: "公司组织架构调整，我是否应该主动申请调去新成立的跨部门创新团队？",
    locale: "zh-Hans",
  },
  {
    id: "case-8-en-complex",
    name: "Case 8 — 英文复杂现实背景 (Hexagram 60 line 4 -> 19)",
    lines: [8, 8, 7, 9, 7, 8], // 节卦六四变，之临卦
    question: "Should we launch our SaaS platform in the European market next month despite incomplete GDPR documentation?",
    locale: "en",
  },
];

async function run() {
  const env = loadSemanticEvalEnv(resolve(process.env.EVAL_ENV_FILE ?? ".env.staging.tmp"));
  console.log("Loaded environment configuration for AI semantic evaluation.");
  console.log("Model Deep Reading:", env.AI_MODEL_DEEP_READING);
  console.log("Model Output Review:", env.AI_MODEL_OUTPUT_REVIEW);

  const provider = await createAiSdkDeepReadingProvider(env);
  const reviewer = await createAiSdkOutputReviewer(env);

  const results: Array<{
    caseId: string;
    name: string;
    question: string;
    locale: "en" | "zh-Hans";
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
    for (const testCase of CASES.filter(item => !process.env.EVAL_CASE || item.id === process.env.EVAL_CASE)) {
    console.log(`\n=== Running ${testCase.name} ===`);
    const facts = makeFacts(testCase.lines);
    const knowledge = await buildDeepReadingKnowledgeBundle(facts);

    const input = {
      kind: "deep_reading" as const,
      castingId: `test_${testCase.id}`,
      question: testCase.question,
      locale: testCase.locale,
      scene: testCase.scene ?? "general",
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
      locale: testCase.locale,
      scene: testCase.scene ?? "general",
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
      locale: testCase.locale,
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
      schemaVersion: "deep-reading-v3",
      readingVariant: facts.readingVariant,
      directAnswer: "This cast indicates severe tension in your romantic relationship and family home. While you are asking about emotional reconciliation with your partner, the cast shows that unresolved conflict from the past is poisoning your domestic peace and you need to tread very carefully around your spouse's anger.",
      whyThisReading: "Your romantic relationship of five years is under immense pressure because of domestic chores and lack of mutual communication. The Lake trigram underneath Heaven shows you tread on your lover's sensitivity without knowing it.",
      whatMattersMost: [
        "Emotional distance between romantic partners",
        "Domestic arguments over household spending versus personal time",
      ],

      whatToDoNext: [
        "Whether your spouse initiates physical affection",
        "Whether domestic dinner conversations can proceed without hostile silence",
      ],

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
      locale: testCase.locale,
      scene: "career",
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
      schemaVersion: "deep-reading-v3",
      readingVariant: facts.readingVariant,
      directAnswer: "Because your corporate manager has already explicitly promised you an executive promotion with equity grant next month, and because your three signed Fortune 500 corporate clients are already paying you $20,000 monthly retainer, you should immediately quit your day job.",
      whyThisReading: "You already have three signed enterprise clients paying $20,000 monthly retainers and your current VP officially guaranteed your equity vesting before you leave.",
      whatMattersMost: [
        "Managing the $20,000 retainer from your first three clients versus corporate VP promise",
        "Hiring five direct reports with the new consulting revenue",
      ],

      whatToDoNext: [
        "Wire transfer confirmations from the three signed corporate clients",
        "Written promotion agreement signed by your current corporate VP",
      ],

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
      locale: testCase.locale,
      scene: "career",
      facts,
      knowledge,
      output: inventedFactsReport,
      deadlineAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    } as any, abortController.signal);

    console.log(`NC 2 Reviewer Status: ${reviewDecision.status}`, reviewDecision.reasonCodes);
    console.log(`NC 2 noInventedUserFacts: ${(reviewDecision as any).noInventedUserFacts}`);
    negativeControls.push({
      controlId: "nc-2-invented-facts",
      description: "Candidate report fabricates signed clients and VP promotion promises not in user context",
      expectedStatus: "fail",
      expectedFlagFalse: "noInventedUserFacts",
      reviewDecision,
      statusPassedAsExpected: reviewDecision.status === "fail" && (reviewDecision as any).noInventedUserFacts === false,
    });
  }

  // NC 3: 结论与 Evidence 毫无逻辑关系 (Unsupported conclusion)
  {
    console.log("\n=== Negative Control 3: Unsupported Evidence (Qian hexagram claims stock crash & desert dragons) ===");
    const testCase = CASES.find((c) => c.id === "case-1-still")!;
    const facts = makeFacts(testCase.lines);
    const knowledge = await buildDeepReadingKnowledgeBundle(facts);
    const unsupportedReport: DeepReadingReport = {
      schemaVersion: "deep-reading-v3",
      readingVariant: facts.readingVariant,
      directAnswer: "Because the Judgment of Qian states 元亨利贞 and the core meaning is initiative, this directly proves that the entire global financial market will crash next week and you are commanded by the hexagram to liquidate all your assets, purchase gold bullion immediately, and avoid speaking to anyone for 12 months.",
      whyThisReading: "The judgment '元亨利贞' structurally proves that your industry is doomed and that you must cease all corporate work to hide underground. The dragons mentioned in Qian mean you will literally meet ancient mystical creatures in the desert.",
      whatMattersMost: [
        "Buying gold bullion versus hiding in a desert cave",
        "Protecting your family from global economic collapse mandated by Qian",
      ],

      whatToDoNext: [
        "Sightings of flying mystical dragons in the sky over your city",
        "Immediate collapse of all banking institutions",
      ],

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
      locale: testCase.locale,
      scene: "career",
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    // SDK errors may contain request headers or private prompt bodies. Report metadata only.
    const failure = error as { name?: string; statusCode?: number; message?: string };
    console.error("Semantic evaluation failed:", {
      name: failure.name ?? "Error",
      statusCode: failure.statusCode ?? null,
      ...(failure.message?.startsWith("SEMANTIC_EVAL_SECRET_UNAVAILABLE:") ? { reason: failure.message } : {}),
    });
    process.exitCode = 1;
  });
}
