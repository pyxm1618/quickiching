import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { DomainError } from "@/server/errors/domain-error";
import type {
  ConsumeLoginIntentAndRevealInput,
  FingerprintCandidate,
  RevealOutcome,
} from "@/server/repositories/reveal-repository";

const QUESTION_LOCK_MS = 72 * 60 * 60 * 1000;

type AtomicRevealInput = Omit<ConsumeLoginIntentAndRevealInput, "fingerprintCandidates"> & {
  fingerprintCandidates: readonly FingerprintCandidate[];
};

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function intentError(code: string, message: string): DomainError {
  return new DomainError(code, message, false);
}

export class PostgresAtomicRepository {
  constructor(private readonly sql: Sql) {}

  async consumeLoginIntentAndReveal(input: AtomicRevealInput): Promise<RevealOutcome> {
    return this.sql.begin(async (tx) => {
      // One authenticated user is the serialization domain for duplicate-question checks,
      // including transitions where old and new HMAC key versions coexist.
      await tx`select pg_advisory_xact_lock(hashtextextended(${input.authenticatedUserId}, 0))`;

      const intents = await tx`
        select * from login_intents where id = ${input.intentId} for update
      `;
      const intent = intents[0];
      if (!intent) throw intentError("LOGIN_INTENT_NOT_FOUND", "Login intent not found.");
      if (intent.consumed_at) {
        throw intentError("LOGIN_INTENT_ALREADY_CONSUMED", "This login intent has already been used.");
      }
      if (new Date(intent.expires_at).getTime() <= input.now.getTime()) {
        throw intentError("LOGIN_INTENT_EXPIRED", "This login intent has expired.");
      }
      if (
        intent.nonce_hash !== input.nonceHash
        || intent.nonce_key_version !== input.nonceKeyVersion
      ) {
        throw intentError("LOGIN_INTENT_NONCE_INVALID", "Login intent verification failed.");
      }
      if (intent.allowed_callback_path !== input.callbackPath) {
        throw intentError("LOGIN_INTENT_CALLBACK_INVALID", "Login callback path is not allowed.");
      }

      const castings = await tx`
        select * from casting_sessions
        where id = ${intent.casting_session_id}
        for update
      `;
      const casting = castings[0];
      if (!casting) throw intentError("CASTING_NOT_FOUND", "Casting session not found.");
      if (casting.lifecycle !== "awaiting_reveal") {
        throw intentError("CASTING_NOT_REVEALABLE", "This casting cannot be revealed.");
      }
      if (casting.anonymous_session_hash !== intent.anonymous_session_hash) {
        throw intentError("LOGIN_INTENT_OWNER_MISMATCH", "Login intent ownership verification failed.");
      }
      if (
        casting.reveal_expires_at
        && new Date(casting.reveal_expires_at).getTime() <= input.now.getTime()
      ) {
        throw intentError("CASTING_REVEAL_EXPIRED", "The reveal window has expired.");
      }

      const candidateKeys = new Set(
        input.fingerprintCandidates.map(
          (candidate) => `${candidate.keyVersion}\u0000${candidate.fingerprint}`,
        ),
      );
      const activeLocks = await tx`
        select question_fingerprint, fingerprint_key_version, winning_casting_id
        from question_locks
        where user_id = ${input.authenticatedUserId}
          and locked_until > ${input.now}
        for update
      `;
      const duplicate = activeLocks.find((lock) => candidateKeys.has(
        `${lock.fingerprint_key_version}\u0000${lock.question_fingerprint}`,
      ));

      if (duplicate) {
        await tx`
          update casting_sessions set
            user_id = ${input.authenticatedUserId},
            anonymous_session_hash = null,
            anonymous_hash_key_version = null,
            lifecycle = 'discarded_duplicate',
            duplicate_of_casting_id = ${duplicate.winning_casting_id},
            updated_at = ${input.now}
          where id = ${casting.id}
        `;
        await tx`
          update login_intents set consumed_at = ${input.now}
          where id = ${input.intentId}
        `;
        return {
          revealed: false,
          duplicate: true,
          castingId: duplicate.winning_casting_id,
        };
      }

      const lockedUntil = new Date(input.now.getTime() + QUESTION_LOCK_MS);
      await tx`
        insert into question_locks (
          user_id, question_fingerprint, fingerprint_key_version,
          winning_casting_id, locked_until, created_at, updated_at
        ) values (
          ${input.authenticatedUserId}, ${input.writeFingerprint.fingerprint},
          ${input.writeFingerprint.keyVersion}, ${casting.id}, ${lockedUntil},
          ${input.now}, ${input.now}
        )
        on conflict (user_id, question_fingerprint, fingerprint_key_version)
        do update set
          winning_casting_id = excluded.winning_casting_id,
          locked_until = excluded.locked_until,
          updated_at = excluded.updated_at
        where question_locks.locked_until <= ${input.now}
      `;

      await tx`
        update casting_sessions set
          user_id = ${input.authenticatedUserId},
          anonymous_session_hash = null,
          anonymous_hash_key_version = null,
          lifecycle = 'revealed',
          question_fingerprint = ${input.writeFingerprint.fingerprint},
          fingerprint_key_version = ${input.writeFingerprint.keyVersion},
          revealed_at = ${input.now},
          updated_at = ${input.now}
        where id = ${casting.id}
      `;
      await tx`
        update login_intents set consumed_at = ${input.now}
        where id = ${input.intentId}
      `;

      return { revealed: true, duplicate: false, castingId: casting.id };
    });
  }

  async freezeForReading(
    readingId: string,
    userId: string,
    now: Date,
  ): Promise<{ reservationId: string } | { error: string }> {
    return this.sql.begin(async (tx) => {
      const readings = await tx`
        select r.id, r.status, r.reservation_id, c.user_id
        from readings r
        join casting_sessions c on c.id = r.casting_session_id
        where r.id = ${readingId}
        for update of r
      `;
      const reading = readings[0];
      if (!reading) throw new DomainError("READING_NOT_FOUND", "Reading not found.", false);
      if (reading.user_id !== userId) {
        throw new DomainError("READING_FORBIDDEN", "Reading not found.", false);
      }

      if (reading.reservation_id) {
        const existing = await tx`
          select id, status from reservations where id = ${reading.reservation_id}
        `;
        if (existing[0] && ["reserved", "consumed"].includes(existing[0].status)) {
          return { reservationId: existing[0].id };
        }
      }

      const batches = await tx`
        select id
        from entitlement_batches
        where user_id = ${userId}
          and quantity_available > 0
          and expires_at > ${now}
        order by expires_at asc, created_at asc, id asc
        limit 1
        for update skip locked
      `;
      const batch = batches[0];
      if (!batch) return { error: "ENTITLEMENT_NOT_AVAILABLE" };

      const reservationId = id("res");
      const ledgerId = id("led");
      await tx`
        update entitlement_batches set
          quantity_available = quantity_available - 1,
          quantity_reserved = quantity_reserved + 1,
          updated_at = ${now}
        where id = ${batch.id}
      `;
      await tx`
        insert into reservations (id, reading_id, batch_id, status, created_at, updated_at)
        values (${reservationId}, ${readingId}, ${batch.id}, 'reserved', ${now}, ${now})
      `;
      await tx`
        insert into entitlement_ledger (
          id, batch_id, action, quantity, reading_id, reservation_id, created_at
        ) values (${ledgerId}, ${batch.id}, 'reserve', 1, ${readingId}, ${reservationId}, ${now})
      `;
      await tx`
        update readings set
          status = 'reserved', reservation_id = ${reservationId}, updated_at = ${now}
        where id = ${readingId}
      `;
      return { reservationId };
    });
  }

  async consumeReservation(
    reservationId: string,
    now: Date,
  ): Promise<{ readingId: string; changed: boolean }> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`
        select * from reservations where id = ${reservationId} for update
      `;
      const reservation = rows[0];
      if (!reservation) throw new DomainError("RESERVATION_NOT_FOUND", "Reservation not found.", false);
      if (reservation.status === "consumed") {
        return { readingId: reservation.reading_id, changed: false };
      }
      if (reservation.status !== "reserved") {
        throw new DomainError("RESERVATION_TERMINAL", "Reservation is already closed.", false);
      }
      await tx`select id from entitlement_batches where id = ${reservation.batch_id} for update`;
      await tx`
        update entitlement_batches set
          quantity_reserved = quantity_reserved - 1,
          quantity_consumed = quantity_consumed + 1,
          updated_at = ${now}
        where id = ${reservation.batch_id}
      `;
      await tx`
        update reservations set status = 'consumed', updated_at = ${now}
        where id = ${reservationId}
      `;
      await tx`
        insert into entitlement_ledger (
          id, batch_id, action, quantity, reading_id, reservation_id, created_at
        ) values (
          ${id("led")}, ${reservation.batch_id}, 'consume', 1,
          ${reservation.reading_id}, ${reservationId}, ${now}
        )
      `;
      return { readingId: reservation.reading_id, changed: true };
    });
  }

  async releaseReservation(
    reservationId: string,
    expired: boolean,
    now: Date,
  ): Promise<{ readingId: string; changed: boolean }> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`
        select * from reservations where id = ${reservationId} for update
      `;
      const reservation = rows[0];
      if (!reservation) throw new DomainError("RESERVATION_NOT_FOUND", "Reservation not found.", false);
      if (reservation.status !== "reserved") {
        return { readingId: reservation.reading_id, changed: false };
      }
      await tx`select id from entitlement_batches where id = ${reservation.batch_id} for update`;
      if (expired) {
        await tx`
          update entitlement_batches set
            quantity_reserved = quantity_reserved - 1,
            quantity_revoked = quantity_revoked + 1,
            updated_at = ${now}
          where id = ${reservation.batch_id}
        `;
      } else {
        await tx`
          update entitlement_batches set
            quantity_reserved = quantity_reserved - 1,
            quantity_available = quantity_available + 1,
            updated_at = ${now}
          where id = ${reservation.batch_id}
        `;
      }
      await tx`
        update reservations set status = ${expired ? "expired" : "released"}, updated_at = ${now}
        where id = ${reservationId}
      `;
      await tx`
        update readings set status = 'failed', reservation_id = null, updated_at = ${now}
        where id = ${reservation.reading_id}
      `;
      await tx`
        insert into entitlement_ledger (
          id, batch_id, action, quantity, reading_id, reservation_id, created_at
        ) values (
          ${id("led")}, ${reservation.batch_id}, ${expired ? "revoke" : "release"}, 1,
          ${reservation.reading_id}, ${reservationId}, ${now}
        )
      `;
      return { readingId: reservation.reading_id, changed: true };
    });
  }
}
