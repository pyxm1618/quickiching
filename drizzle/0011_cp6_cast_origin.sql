-- CP6 commercial front-end loop: record how a cast's line values reached us.
--
-- drizzle-kit also re-emitted three statements that 0009/0010 had already
-- applied by hand (entitlement_reservations.job_id NOT NULL and
-- entitlement_reservations_lease_check from 0009's inline DDL,
-- deep_reading_results.integrity_key_version from 0010). Those migrations
-- carry no matching snapshot, so the diff was taken against 0009's stale one.
-- Replaying them would fail on an already-migrated database, so only the real
-- delta is kept here; 0011_snapshot.json records the reconciled state and
-- future generates start clean.
ALTER TABLE "casting_sessions" ADD COLUMN "cast_origin" text DEFAULT 'server_generated' NOT NULL;--> statement-breakpoint
ALTER TABLE "casting_sessions" ADD CONSTRAINT "casting_sessions_cast_origin_check" CHECK ("casting_sessions"."cast_origin" in ('server_generated', 'client_attested'));
