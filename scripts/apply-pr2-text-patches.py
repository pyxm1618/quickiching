from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, found {count}")
    target.write_text(text.replace(old, new, 1))


latest_context = '''  getLatestQuestionContext(castingSessionId: string): string {
    let latest: QuestionVersion | null = null;
    for (const version of this.store.questionVersions.values()) {
      if (version.castingSessionId !== castingSessionId) continue;
      if (!latest || version.versionNumber > latest.versionNumber) latest = version;
    }
    if (!latest) return "";
    const blob = { v: latest.encryptionKeyVersion, iv: latest.iv, tag: latest.authTag, data: latest.ciphertext };
    return decryptJson<{ context: string }>(blob, "context", `${castingSessionId}:${latest.id}`).context;
  }
'''
replace_once(
    "src/server/repositories/memory/casting-repository.ts",
    latest_context,
    latest_context + '''
  getQuestionVersionCount(castingSessionId: string): number {
    return [...this.store.questionVersions.values()]
      .filter((version) => version.castingSessionId === castingSessionId)
      .length;
  }
''',
)

replace_once(
    "src/server/repositories/memory/index.ts",
    '    getLatestQuestionContext: (castingSessionId) => casting.getLatestQuestionContext(castingSessionId),\n',
    '    getLatestQuestionContext: (castingSessionId) => casting.getLatestQuestionContext(castingSessionId),\n'
    '    getQuestionVersionCount: (castingSessionId) => casting.getQuestionVersionCount(castingSessionId),\n',
)

replace_once(
    "src/app/actions.ts",
    'import { RevealService } from "@/server/services/reveal-service";\n',
    'import { RevealService } from "@/server/services/reveal-service";\n'
    'import { RiskService } from "@/server/services/risk-service";\n',
)

casting_service = '''const castingService = new CastingService({
  castingRepository: repo,
  clock: { now: () => new Date() },
  randomSource: { randomBit: cryptoRandomBit, randomInt: cryptoRandomInt },
  riskService: { evaluate: evaluateRisk },
});
'''
replace_once(
    "src/app/actions.ts",
    casting_service,
    casting_service + '''
const riskService = new RiskService({
  castingRepository,
  evaluator: { evaluate: evaluateRisk },
});
''',
)

submit_block = '''async function submitQuestionActionImpl(unknownInput: unknown): Promise<
  ActionResult<{ riskStatus: string; reasonCode: string; emergency: boolean }>
> {
  const parsed = parseBoundaryInput(actionSchemas.submitQuestion, unknownInput, "submitQuestionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.submitQuestion(input.castingId, input.context));
}
'''
replace_once(
    "src/app/actions.ts",
    submit_block,
    submit_block + '''

async function clarifyQuestionActionImpl(unknownInput: unknown): Promise<
  ActionResult<{ riskStatus: string; reasonCode: string; emergency: boolean }>
> {
  const parsed = parseBoundaryInput(actionSchemas.clarifyQuestion, unknownInput, "clarifyQuestionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const decision = riskService.clarifyQuestion(input.castingId, input.context);
  return ok({
    riskStatus: decision.status,
    reasonCode: decision.reasonCode,
    emergency: decision.status === "emergency_blocked",
  });
}
''',
)

replace_once(
    "src/app/actions.ts",
    '''  if (session.riskStatus === "professional_decision_blocked" || session.riskStatus === "emergency_blocked")
    return fail("RISK_BLOCKED", "A personalized preview is not available for this question", false);

  const existing = repo.getPreview(input.castingId);
''',
    '''  const existing = repo.getPreview(input.castingId);
''',
)

replace_once(
    "src/app/actions.ts",
    '''  const result = repo.getCastResult(input.castingId);
  if (!result) return fail("RESULT_MISSING", "Cast result missing", false);
  const context = repo.getLatestQuestionContext(input.castingId);

  try {
''',
    '''  const result = repo.getCastResult(input.castingId);
  if (!result) return fail("RESULT_MISSING", "Cast result missing", false);
  const { context } = riskService.recheckPersonalizedGeneration(input.castingId);

  try {
''',
)

replace_once(
    "src/app/actions.ts",
    '''  if (session.riskStatus === "professional_decision_blocked" || session.riskStatus === "emergency_blocked")
    return fail("RISK_BLOCKED", "A deep reading is not available for this question", false);

  const reading = repo.getOrCreateReading(input.castingId);
''',
    '''  const reading = repo.getOrCreateReading(input.castingId);
''',
)

replace_once(
    "src/app/actions.ts",
    '''  const freeze = repo.freezeForReading(reading.id, user.id, new Date());
''',
    '''  const { context } = riskService.recheckPersonalizedGeneration(input.castingId);
  const freeze = repo.freezeForReading(reading.id, user.id, new Date());
''',
)

replace_once(
    "src/app/actions.ts",
    '''  const result = repo.getCastResult(input.castingId)!;
  const context = repo.getLatestQuestionContext(input.castingId);
  try {
''',
    '''  const result = repo.getCastResult(input.castingId)!;
  try {
''',
)

replace_once(
    "src/app/actions.ts",
    'export const submitQuestionAction = withActionErrorBoundary("submitQuestionAction", submitQuestionActionImpl);\n',
    'export const submitQuestionAction = withActionErrorBoundary("submitQuestionAction", submitQuestionActionImpl);\n'
    'export const clarifyQuestionAction = withActionErrorBoundary("clarifyQuestionAction", clarifyQuestionActionImpl);\n',
)

Path("scripts/apply-pr2-text-patches.py").unlink()
Path(".github/workflows/apply-pr2-patches.yml").unlink()
