from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, found {count}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "src/app/actions.ts",
    'import { repo, castingRepository, loginIntentRepository, revealRepository } from "@/server/repository";',
    'import {\n'
    '  repo,\n'
    '  castingRepository,\n'
    '  loginIntentRepository,\n'
    '  revealRepository,\n'
    '  readingRepository,\n'
    '  entitlementRepository,\n'
    '  reviewRepository,\n'
    '  privacyRepository,\n'
    '} from "@/server/repository";',
)

replace_once(
    "src/app/actions.ts",
    'import { RiskService } from "@/server/services/risk-service";\n',
    'import { RiskService } from "@/server/services/risk-service";\n'
    'import { CastingSnapshotService } from "@/server/services/casting-snapshot-service";\n'
    'import { QualityReviewService } from "@/server/services/quality-review-service";\n'
    'import { PrivacyService } from "@/server/services/privacy-service";\n',
)

risk_service = '''const riskService = new RiskService({
  castingRepository,
  evaluator: { evaluate: evaluateRisk },
});
'''
replace_once(
    "src/app/actions.ts",
    risk_service,
    risk_service + '''
const castingSnapshotService = new CastingSnapshotService({
  castingRepository,
  readingRepository,
});
const qualityReviewService = new QualityReviewService({
  reviewRepository,
  readingRepository,
  entitlementRepository,
  clock: { now: () => new Date() },
});
const privacyService = new PrivacyService({
  privacyRepository,
  castingRepository,
  clock: { now: () => new Date() },
});
''',
)

summary_marker = '// ---- Standalone dev sign-in (Better Auth is the production target) ----\n'
snapshot_action = '''async function getCastingSnapshotActionImpl(unknownInput: unknown): Promise<ActionResult<ReturnType<CastingSnapshotService["load"]>>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "getCastingSnapshotAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  const anonHash = await getAnonymousHash();
  return ok(castingSnapshotService.load({
    castingId: parsed.castingId,
    userId: user?.id ?? null,
    anonymousSessionHash: anonHash,
    now: new Date(),
  }));
}

'''
replace_once("src/app/actions.ts", summary_marker, snapshot_action + summary_marker)

old_review = '''// ---- 12. Quality review (QUALITY-001/002) ----
async function submitQualityReviewActionImpl(unknownInput: unknown): Promise<ActionResult<{ reviewId: string; status: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.submitQualityReview, unknownInput, "submitQualityReviewAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  try {
    const review = repo.createQualityReview({
      readingId: input.readingId,
      userId: user.id,
      reason: input.reason,
    });
    return ok({ reviewId: review.id, status: review.status });
  } catch (error) {
    if (error instanceof DomainError && error.code === "QUALITY_REVIEW_ALREADY_SUBMITTED") {
      return mapKnownDomainError(
        error,
        { action: "submitQualityReviewAction" },
      );
    }
    throw error;
  }
}
'''
new_review = '''// ---- 12. Quality review (QUALITY-001/002) ----
async function submitQualityReviewActionImpl(unknownInput: unknown): Promise<ActionResult<{ reviewId: string; status: string; responseDueAt: Date }>> {
  const parsed = parseBoundaryInput(actionSchemas.submitQualityReview, unknownInput, "submitQualityReviewAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const review = qualityReviewService.submit({
    readingId: input.readingId,
    userId: user.id,
    reason: input.reason,
  });
  return ok({ reviewId: review.id, status: review.status, responseDueAt: review.responseDueAt });
}
'''
replace_once("src/app/actions.ts", old_review, new_review)

old_delete = '''// ---- 13. Deletion request (PRIV-002) ----
async function requestCastingDeletionActionImpl(unknownInput: unknown): Promise<ActionResult<{ deleted: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "requestCastingDeletionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  repo.requestCastingDeletion(input.castingId);
  return ok({ deleted: true });
}
'''
new_delete = '''// ---- 13. Deletion request and recovery (PRIV-002) ----
async function requestCastingDeletionActionImpl(unknownInput: unknown): Promise<ActionResult<{ deleted: boolean; purgeAfter: Date }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "requestCastingDeletionAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const deleted = privacyService.requestDeletion(parsed.castingId, user.id);
  return ok({ deleted: true, purgeAfter: deleted.purgeAfter! });
}

async function restoreCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ restored: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "restoreCastingAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  privacyService.restore(parsed.castingId, user.id);
  return ok({ restored: true });
}
'''
replace_once("src/app/actions.ts", old_delete, new_delete)

replace_once(
    "src/app/actions.ts",
    'export const getCastingSummaryAction = withActionErrorBoundary("getCastingSummaryAction", getCastingSummaryActionImpl);\n',
    'export const getCastingSummaryAction = withActionErrorBoundary("getCastingSummaryAction", getCastingSummaryActionImpl);\n'
    'export const getCastingSnapshotAction = withActionErrorBoundary("getCastingSnapshotAction", getCastingSnapshotActionImpl);\n',
)
replace_once(
    "src/app/actions.ts",
    'export const requestCastingDeletionAction = withActionErrorBoundary("requestCastingDeletionAction", requestCastingDeletionActionImpl);\n',
    'export const requestCastingDeletionAction = withActionErrorBoundary("requestCastingDeletionAction", requestCastingDeletionActionImpl);\n'
    'export const restoreCastingAction = withActionErrorBoundary("restoreCastingAction", restoreCastingActionImpl);\n',
)

Path("scripts/apply-pr3-actions.py").unlink()
Path(".github/workflows/apply-pr3-actions.yml").unlink()
