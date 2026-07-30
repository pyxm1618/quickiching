from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one match in {path}, found {count}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/server/services/casting-service.ts",
    'castingRepository.transitionCasting(active.id, "user_deleted");',
    'castingRepository.transitionCasting(active.id, "cancelled");',
)

replace_once(
    "src/server/services/casting-service.test.ts",
    'expect(repositories.castingRepository.getCastingSession(first.castingId)?.lifecycle).toBe("user_deleted");',
    'expect(repositories.castingRepository.getCastingSession(first.castingId)?.lifecycle).toBe("cancelled");',
)

replace_once(
    "src/app/actions.ts",
    'import { normalizeComposite, fingerprintQuestion } from "@/domain/questions/normalize";\n',
    '',
)

replace_once(
    "src/app/actions.ts",
    'import { repo } from "@/server/repository";',
    'import { repo, castingRepository, loginIntentRepository, revealRepository } from "@/server/repository";',
)

replace_once(
    "src/app/actions.ts",
    'import { CastingService } from "@/server/services/casting-service";\n',
    'import { CastingService } from "@/server/services/casting-service";\n'
    'import { RevealService } from "@/server/services/reveal-service";\n'
    'import { runtimeConfig } from "@/server/config";\n',
)

replace_once(
    "src/app/actions.ts",
    'const FINGERPRINT_KEY_VERSION = "v1";\n\n',
    '',
)

casting_service_block = '''const castingService = new CastingService({
  castingRepository: repo,
  clock: { now: () => new Date() },
  randomSource: { randomBit: cryptoRandomBit, randomInt: cryptoRandomInt },
  riskService: { evaluate: evaluateRisk },
});
'''

replace_once(
    "src/app/actions.ts",
    casting_service_block,
    casting_service_block + '''
function getRevealService(): RevealService {
  const config = runtimeConfig();
  return new RevealService({
    castingRepository,
    loginIntentRepository,
    revealRepository,
    clock: { now: () => new Date() },
    tokenSource: { randomToken: () => randomToken(32) },
    sessionSigningKeys: config.keys.sessionSigning,
    questionFingerprintKeys: config.keys.questionFingerprint,
  });
}
''',
)

old_reveal = '''// ---- 7. Reveal: dev sign-in + atomic bind + 72h lock (AUTH-003, CAST-004) ----
async function revealCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ revealed: boolean; duplicate: boolean; winningCastingId?: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.revealCasting, unknownInput, "revealCastingAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  if (!repo.ownsCasting(input.castingId, null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(input.castingId)!;
  if (session.lifecycle !== "awaiting_reveal")
    return fail("CASTING_NOT_REVEALABLE", "This casting is not ready to be revealed", false);

  const user = await devSignIn(input.email);

  const context = repo.getLatestQuestionContext(input.castingId);
  const composite = normalizeComposite(session.scene, session.interpretationGoal, context);
  const fingerprint = fingerprintQuestion(composite, "question", FINGERPRINT_KEY_VERSION);

  try {
    return ok(repo.revealWithQuestionLock({
      castingId: input.castingId,
      userId: user.id,
      fingerprint,
      keyVersion: FINGERPRINT_KEY_VERSION,
      now: new Date(),
    }));
  } catch (error) {
    return mutationFailure(error);
  }
}
'''

new_reveal = '''// ---- 7. Reveal: local auth callback over single-use Login Intent (AUTH-003, CAST-004) ----
async function revealCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ revealed: boolean; duplicate: boolean; castingId: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.revealCasting, unknownInput, "revealCastingAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  if (!anonHash || !repo.ownsCasting(input.castingId, null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);

  const config = runtimeConfig();
  if (config.auth !== "dev") {
    throw new DomainError(
      "AUTH_PROVIDER_REQUIRED",
      "Sign in through the configured authentication provider to reveal this casting.",
      false,
    );
  }

  const revealService = getRevealService();
  const callbackPath = `/result/${input.castingId}`;
  const intent = revealService.startLoginIntent({
    castingId: input.castingId,
    anonymousSessionHash: anonHash,
    allowedCallbackPath: callbackPath,
  });
  const user = await devSignIn(input.email);
  return ok(revealService.consumeLoginIntentAndReveal({
    intentId: intent.intentId,
    nonce: intent.nonce,
    authenticatedUserId: user.id,
    callbackPath,
  }));
}
'''

replace_once("src/app/actions.ts", old_reveal, new_reveal)

# Remove this one-shot patch mechanism from the resulting branch.
Path("scripts/apply-pr1-text-patches.py").unlink()
Path(".github/workflows/apply-pr1-patches.yml").unlink()
