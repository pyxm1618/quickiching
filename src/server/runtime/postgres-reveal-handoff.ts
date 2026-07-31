import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { fingerprintQuestion, normalizeComposite } from "@/domain/questions/normalize";
import { decryptJson, randomToken } from "@/lib/crypto";
import {
  assertAllowedCallbackPath,
  createLoginHandoffState,
  emailMatches,
  hashLoginExpectedEmail,
  hashLoginIntentNonce,
  verifyLoginHandoffState,
} from "@/server/auth/login-intent";
import {
  decodeVersionedKeyValue,
  resolveVersionedKey,
  resolveWriteKey,
  runtimeConfig,
} from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import { PostgresAtomicRepository } from "@/server/repositories/postgres/atomic-repository";
import type { RevealOutcome } from "@/server/repositories/reveal-repository";

const LOGIN_INTENT_TTL_MS = 10 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function asDate(value: unknown): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(String(value));
}

export class PostgresRevealHandoffService {
  private readonly atomicRepository: PostgresAtomicRepository;

  constructor(private readonly dependencies: {
    sql: Sql;
    clock: { now(): Date };
  }) {
    this.atomicRepository = new PostgresAtomicRepository(dependencies.sql);
  }

  async start(input: {
    castingId: string;
    anonymousSessionHash: string;
    expectedEmail: string;
    allowedCallbackPath: string;
  }): Promise<{
    handoffState: string;
    allowedCallbackPath: string;
    expiresAt: Date;
  }> {
    const callbackPath = assertAllowedCallbackPath(input.allowedCallbackPath);
    const now = this.dependencies.clock.now();
    const config = runtimeConfig();
    const key = resolveWriteKey(config.keys.sessionSigning);
    const token = randomToken(32);
    const intentId = id("lint");

    return this.dependencies.sql.begin(async (tx) => {
      const rows = await tx`
        select * from casting_sessions where id = ${input.castingId} for update
      `;
      const casting = rows[0];
      if (
        !casting
        || casting.user_id != null
        || casting.anonymous_session_hash !== input.anonymousSessionHash
        || casting.lifecycle !== "awaiting_reveal"
      ) {
        throw new DomainError("CASTING_NOT_REVEALABLE", "This casting is not ready to reveal.", false);
      }

      const revealExpiresAt = asDate(casting.reveal_expires_at);
      if (revealExpiresAt && revealExpiresAt.getTime() <= now.getTime()) {
        await tx`
          update casting_sessions set lifecycle = 'expired', updated_at = ${now}
          where id = ${input.castingId}
        `;
        throw new DomainError("CASTING_EXPIRED", "This casting is no longer available to reveal.", false);
      }

      const expiresAt = new Date(Math.min(
        now.getTime() + LOGIN_INTENT_TTL_MS,
        revealExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
      ));
      await tx`
        insert into login_intents (
          id, casting_session_id, anonymous_session_hash,
          nonce_hash, nonce_key_version,
          expected_email_hash, expected_email_key_version,
          allowed_callback_path, expires_at, created_at
        ) values (
          ${intentId}, ${input.castingId}, ${input.anonymousSessionHash},
          ${hashLoginIntentNonce(token, key)}, ${key.version},
          ${hashLoginExpectedEmail(input.expectedEmail, key)}, ${key.version},
          ${callbackPath}, ${expiresAt}, ${now}
        )
      `;

      return {
        handoffState: createLoginHandoffState(token, key),
        allowedCallbackPath: callbackPath,
        expiresAt,
      };
    });
  }

  async consume(input: {
    handoffState: string;
    authenticatedUserId: string;
    authenticatedEmail: string;
  }): Promise<RevealOutcome> {
    const config = runtimeConfig();
    const verified = verifyLoginHandoffState(input.handoffState, config.keys.sessionSigning);
    if (!verified) {
      throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
    }

    const nonceKey = resolveVersionedKey(config.keys.sessionSigning, verified.keyVersion);
    const nonceHash = hashLoginIntentNonce(verified.token, nonceKey);
    const intentRows = await this.dependencies.sql`
      select * from login_intents
      where nonce_hash = ${nonceHash} and nonce_key_version = ${verified.keyVersion}
      limit 1
    `;
    const intent = intentRows[0];
    if (!intent) {
      throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
    }
    if (
      !intent.expected_email_hash
      || !intent.expected_email_key_version
      || !emailMatches(
        intent.expected_email_hash,
        intent.expected_email_key_version,
        input.authenticatedEmail,
        config.keys.sessionSigning,
      )
    ) {
      throw new DomainError(
        "LOGIN_INTENT_EMAIL_MISMATCH",
        "This sign-in identity does not match the requested email.",
        false,
      );
    }

    const castingRows = await this.dependencies.sql`
      select c.*, q.id as question_id, q.ciphertext, q.iv, q.auth_tag, q.encryption_key_version
      from casting_sessions c
      join question_versions q on q.id = c.current_question_version_id
      where c.id = ${intent.casting_session_id}
    `;
    const casting = castingRows[0];
    if (!casting) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
    }
    const context = decryptJson<{ context: string }>({
      v: casting.encryption_key_version,
      iv: casting.iv,
      tag: casting.auth_tag,
      data: casting.ciphertext,
    }, "context", `${casting.id}:${casting.question_id}`).context;
    const composite = normalizeComposite(casting.scene, casting.interpretation_goal, context);
    const candidates = config.keys.questionFingerprint.read.map((key) => ({
      keyVersion: key.version,
      fingerprint: fingerprintQuestion(
        composite,
        decodeVersionedKeyValue(key.value),
        key.version,
      ),
    }));
    const writeKey = resolveWriteKey(config.keys.questionFingerprint);
    const writeFingerprint = candidates.find(
      (candidate) => candidate.keyVersion === writeKey.version,
    );
    if (!writeFingerprint) throw new Error("QUESTION_FINGERPRINT_WRITE_KEY_MISSING");

    return this.atomicRepository.consumeLoginIntentAndReveal({
      intentId: intent.id,
      nonceHash,
      nonceKeyVersion: verified.keyVersion,
      authenticatedUserId: input.authenticatedUserId,
      callbackPath: assertAllowedCallbackPath(intent.allowed_callback_path),
      fingerprintCandidates: candidates,
      writeFingerprint,
      now: this.dependencies.clock.now(),
    });
  }
}
