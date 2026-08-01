import type { Sql } from "postgres";
import { fingerprintQuestion, normalizeComposite } from "@/domain/questions/normalize";
import { decryptJson } from "@/lib/crypto";
import { resolveWriteKey, runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import type { RevealOutcome } from "@/server/repositories/reveal-repository";

const QUESTION_LOCK_MS = 72 * 60 * 60 * 1000;

type Row = Record<string, unknown>;

function date(value: unknown): Date | null {
  return value == null ? null : value instanceof Date ? value : new Date(String(value));
}

export class PostgresAuthenticatedRevealService {
  constructor(private readonly dependencies: {
    sql: Sql;
    clock: { now(): Date };
  }) {}

  async reveal(input: {
    castingId: string;
    authenticatedUserId: string;
    anonymousSessionHash: string | null;
  }): Promise<RevealOutcome> {
    const now = this.dependencies.clock.now();
    const config = runtimeConfig();

    return this.dependencies.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${input.authenticatedUserId}, 0))`;
      const rows = await tx`
        select c.*, q.id as question_id, q.ciphertext, q.iv, q.auth_tag, q.encryption_key_version
        from casting_sessions c
        join question_versions q on q.id = c.current_question_version_id
        where c.id = ${input.castingId}
        for update of c
      `;
      const casting = rows[0] as Row | undefined;
      const ownedByUser = casting?.user_id === input.authenticatedUserId;
      const ownedByAnonymousSession = casting?.user_id == null
        && input.anonymousSessionHash != null
        && casting?.anonymous_session_hash === input.anonymousSessionHash;
      if (!casting || casting.deleted_at || (!ownedByUser && !ownedByAnonymousSession)) {
        throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
      }
      if (casting.lifecycle === "revealed" && ownedByUser) {
        return { revealed: true, duplicate: false, castingId: input.castingId };
      }
      if (casting.lifecycle !== "awaiting_reveal") {
        throw new DomainError("CASTING_NOT_REVEALABLE", "This casting is not ready to reveal.", false);
      }
      const revealExpiresAt = date(casting.reveal_expires_at);
      if (revealExpiresAt && revealExpiresAt.getTime() <= now.getTime()) {
        await tx`
          update casting_sessions set lifecycle = 'expired', updated_at = ${now}
          where id = ${input.castingId}
        `;
        throw new DomainError("CASTING_EXPIRED", "This casting is no longer available to reveal.", false);
      }

      const context = decryptJson<{ context: string }>({
        v: String(casting.encryption_key_version),
        iv: String(casting.iv),
        tag: String(casting.auth_tag),
        data: String(casting.ciphertext),
      }, "context", `${input.castingId}:${String(casting.question_id)}`).context;
      const composite = normalizeComposite(
        casting.scene as Parameters<typeof normalizeComposite>[0],
        casting.interpretation_goal as Parameters<typeof normalizeComposite>[1],
        context,
      );
      const fingerprintCandidates = config.keys.questionFingerprint.read.map((key) => ({
        keyVersion: key.version,
        fingerprint: fingerprintQuestion(composite, key.value, key.version),
      }));
      const candidateKeys = new Set(
        fingerprintCandidates.map((candidate) => `${candidate.keyVersion}\u0000${candidate.fingerprint}`),
      );
      const activeLocks = await tx`
        select question_fingerprint, fingerprint_key_version, winning_casting_id
        from question_locks
        where user_id = ${input.authenticatedUserId}
          and locked_until > ${now}
        for update
      `;
      const duplicate = activeLocks.find((lock) => (
        String(lock.winning_casting_id) !== input.castingId
        && candidateKeys.has(`${String(lock.fingerprint_key_version)}\u0000${String(lock.question_fingerprint)}`)
      ));

      if (duplicate) {
        await tx`
          update casting_sessions set
            user_id = ${input.authenticatedUserId},
            anonymous_session_hash = null,
            anonymous_hash_key_version = null,
            lifecycle = 'discarded_duplicate',
            duplicate_of_casting_id = ${duplicate.winning_casting_id},
            updated_at = ${now}
          where id = ${input.castingId}
        `;
        return {
          revealed: false,
          duplicate: true,
          castingId: String(duplicate.winning_casting_id),
        };
      }

      const writeKey = resolveWriteKey(config.keys.questionFingerprint);
      const writeFingerprint = fingerprintCandidates.find(
        (candidate) => candidate.keyVersion === writeKey.version,
      );
      if (!writeFingerprint) throw new Error("QUESTION_FINGERPRINT_WRITE_KEY_UNAVAILABLE");
      const lockedUntil = new Date(now.getTime() + QUESTION_LOCK_MS);
      await tx`
        insert into question_locks (
          user_id, question_fingerprint, fingerprint_key_version,
          winning_casting_id, locked_until, created_at, updated_at
        ) values (
          ${input.authenticatedUserId}, ${writeFingerprint.fingerprint},
          ${writeFingerprint.keyVersion}, ${input.castingId}, ${lockedUntil}, ${now}, ${now}
        )
        on conflict (user_id, question_fingerprint, fingerprint_key_version)
        do update set
          winning_casting_id = excluded.winning_casting_id,
          locked_until = excluded.locked_until,
          updated_at = excluded.updated_at
        where question_locks.locked_until <= ${now}
      `;
      await tx`
        update casting_sessions set
          user_id = ${input.authenticatedUserId},
          anonymous_session_hash = null,
          anonymous_hash_key_version = null,
          lifecycle = 'revealed',
          question_fingerprint = ${writeFingerprint.fingerprint},
          fingerprint_key_version = ${writeFingerprint.keyVersion},
          revealed_at = ${now},
          updated_at = ${now}
        where id = ${input.castingId}
      `;
      return { revealed: true, duplicate: false, castingId: input.castingId };
    });
  }
}
