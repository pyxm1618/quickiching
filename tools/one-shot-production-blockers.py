from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one occurrence, found {count}: {old[:80]!r}")
    write(path, text.replace(old, new, 1))


def replace_regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex occurrence, found {count}: {pattern[:80]!r}")
    write(path, updated)


# 1. Production action ownership and authenticated reveal.
replace_once(
    "src/app/production-actions.ts",
    'import { getAnonymousHash, getCurrentUser } from "@/lib/auth/session";',
    'import { getAnonymousHash, getOrCreateAnonymousHash, getCurrentUser } from "@/lib/auth/session";',
)
replace_once(
    "src/app/production-actions.ts",
    'import { getProductionRuntime } from "@/server/runtime/production";',
    'import { getProductionRuntime } from "@/server/runtime/production";\nimport { PostgresAuthenticatedRevealService } from "@/server/runtime/postgres-authenticated-reveal";',
)
replace_regex_once(
    "src/app/production-actions.ts",
    r"async function owner\(\) \{.*?\n\}",
    '''async function owner(options: { createAnonymous?: boolean } = {}) {
  const user = await getCurrentUser();
  const anonymousSessionHash = options.createAnonymous && !user
    ? await getOrCreateAnonymousHash()
    : await getAnonymousHash();
  return { user, anonymousSessionHash };
}''',
)
replace_once(
    "src/app/production-actions.ts",
    '''    const { user, anonymousSessionHash } = await owner();
    if (!user && !anonymousSessionHash) return fail("CASTING_OWNER_REQUIRED", "Casting owner is required.", false);
    const ownerKind = user ? "user" as const : "anonymous" as const;''',
    '''    const { user, anonymousSessionHash } = await owner({ createAnonymous: true });
    const ownerKind = user ? "user" as const : "anonymous" as const;''',
)
replace_regex_once(
    "src/app/production-actions.ts",
    r"async function revealCastingAction\(unknownInput: unknown\) \{.*?\n\}\n\nasync function startPreviewAction",
    '''async function revealCastingAction(unknownInput: unknown) {
  return boundary("revealCastingAction", async () => {
    const input = parseActionInput(actionSchemas.revealCasting, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const runtime = await getProductionRuntime();

    if (user) {
      await guard({
        action: "reveal_casting",
        turnstileToken: input.turnstileToken,
        dimensions: [
          { kind: "user", value: user.id, limit: 5, windowMs: TEN_MINUTES_MS },
          ...(anonymousSessionHash
            ? [{ kind: "anonymous" as const, value: anonymousSessionHash, limit: 5, windowMs: TEN_MINUTES_MS }]
            : []),
        ],
      });
      const reveal = new PostgresAuthenticatedRevealService({
        sql: runtime.sql,
        clock: { now: () => new Date() },
      });
      return ok(await reveal.reveal({
        castingId: input.castingId,
        authenticatedUserId: user.id,
        anonymousSessionHash,
      }));
    }

    if (!anonymousSessionHash) {
      return fail("CASTING_NOT_FOUND", "Casting session not found.", false);
    }
    const requestHeaders = await guard({
      action: "reveal_casting",
      turnstileToken: input.turnstileToken,
      dimensions: [
        { kind: "anonymous", value: anonymousSessionHash, limit: 5, windowMs: TEN_MINUTES_MS },
        { kind: "email", value: input.email, limit: 3, windowMs: TEN_MINUTES_MS },
      ],
    });
    const callbackPath = `/result/${input.castingId}`;
    const handoff = await runtime.revealHandoff.start({
      castingId: input.castingId,
      anonymousSessionHash,
      expectedEmail: input.email,
      allowedCallbackPath: callbackPath,
    });
    const auth = await getProductionAuth();
    await auth.api.signInMagicLink({
      body: {
        email: input.email,
        callbackURL: `/reveal/complete?state=${encodeURIComponent(handoff.handoffState)}`,
        errorCallbackURL: "/signin?error=reveal_intent",
      },
      headers: requestHeaders,
    });
    return ok({
      revealed: false,
      duplicate: false,
      castingId: input.castingId,
      authPending: true as const,
    });
  });
}

async function startPreviewAction''',
)

write(
    "src/server/runtime/postgres-authenticated-reveal.ts",
    '''import type { Sql } from "postgres";
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
        fingerprintCandidates.map((candidate) => `${candidate.keyVersion}\\u0000${candidate.fingerprint}`),
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
        && candidateKeys.has(`${String(lock.fingerprint_key_version)}\\u0000${String(lock.question_fingerprint)}`)
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
''',
)

# 2. Safe callback path and sign-in routing.
write(
    "src/lib/auth/callback-path.ts",
    '''export function safeCallbackPath(value: string | null | undefined, fallback = "/account"): string {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\\\")) {
    return fallback;
  }
  try {
    const base = new URL("https://app.invalid");
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
''',
)
write(
    "src/lib/auth/callback-path.test.ts",
    '''import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./callback-path";

describe("safeCallbackPath", () => {
  it("preserves local result paths and query strings", () => {
    expect(safeCallbackPath("/result/cas_123?from=signin#reading")).toBe(
      "/result/cas_123?from=signin#reading",
    );
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\\\attacker.example/path",
    "javascript:alert(1)",
    "",
  ])("rejects unsafe callback %s", (candidate) => {
    expect(safeCallbackPath(candidate)).toBe("/account");
  });
});
''',
)
write(
    "src/app/signin/page.tsx",
    '''"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/actions";
import { authClient } from "@/lib/auth/auth-client";
import { safeCallbackPath } from "@/lib/auth/callback-path";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SealMark } from "@/components/hex/seal-mark";

const productionAuth = process.env.NEXT_PUBLIC_AUTH_ADAPTER_MODE === "better-auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [callbackPath, setCallbackPath] = useState("/account");

  useEffect(() => {
    setHydrated(true);
    const callback = new URLSearchParams(window.location.search).get("callbackURL");
    setCallbackPath(safeCallbackPath(callback));
  }, []);

  function providerErrorPath(provider: string): string {
    const params = new URLSearchParams({ error: provider, callbackURL: callbackPath });
    return `/signin?${params.toString()}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hydrated) return;
    setPending(true);
    setError(null);
    setNotice(null);

    if (productionAuth) {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: callbackPath,
        errorCallbackURL: providerErrorPath("magic_link"),
      });
      if (result.error) {
        setError("The sign-in link could not be sent. Please try again.");
        setPending(false);
        return;
      }
      setNotice("Check your email. The sign-in link expires in 10 minutes and works once.");
      setPending(false);
      return;
    }

    const result = await signInAction({ email });
    if (result.ok) {
      router.push(callbackPath);
      return;
    }
    setError(result.error.message);
    setPending(false);
  }

  async function signInWithGoogle() {
    if (!hydrated) return;
    setPending(true);
    setError(null);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackPath,
      errorCallbackURL: providerErrorPath("google"),
    });
    if (result.error) {
      setError("Google sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <SealMark size="lg" tilt />
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">
          Sign in to your account
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[var(--ink-3)]">
            {productionAuth
              ? "Use a one-time email link or Google. No password is stored by this application."
              : "Local development sign-in by email."}
          </p>
          {productionAuth && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending || !hydrated}
                onClick={signInWithGoogle}
              >
                Continue with Google
              </Button>
              <div className="my-4 flex items-center gap-3 text-xs text-[var(--ink-3)]">
                <span className="h-px flex-1 bg-[var(--line)]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>
            </>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            {notice && <p className="text-sm text-[var(--jade)]">{notice}</p>}
            <Button type="submit" disabled={pending || !hydrated} className="w-full">
              {pending ? "Working…" : productionAuth ? "Email me a sign-in link" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
''',
)

# 3. Result page Preview and Deep Reading controls.
write(
    "src/components/cast/result-reading-controls.tsx",
    '''"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startDeepReadingAction, startPreviewAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";

export function ResultReadingControls(props: {
  castingId: string;
  isAuthed: boolean;
  previewStatus: string | null;
  readingStatus: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [readingToken, setReadingToken] = useState<string | null>(null);
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const [readingResetKey, setReadingResetKey] = useState(0);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const challengeRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const previewComplete = props.previewStatus === "completed";
  const readingComplete = props.readingStatus === "completed";

  useEffect(() => {
    if (!polling || (previewComplete && readingComplete)) return;
    const interval = window.setInterval(() => router.refresh(), 1800);
    const timeout = window.setTimeout(() => setPolling(false), 60_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [polling, previewComplete, readingComplete, router]);

  useEffect(() => {
    if (previewComplete || readingComplete) setPolling(false);
  }, [previewComplete, readingComplete]);

  function generatePreview() {
    if (challengeRequired && !previewToken) return;
    const token = previewToken ?? undefined;
    setPreviewToken(null);
    setError(null);
    startTransition(async () => {
      const result = await startPreviewAction({ castingId: props.castingId, turnstileToken: token });
      setPreviewResetKey((value) => value + 1);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPolling(true);
      router.refresh();
    });
  }

  function generateReading() {
    if (challengeRequired && !readingToken) return;
    const token = readingToken ?? undefined;
    setReadingToken(null);
    setError(null);
    startTransition(async () => {
      const result = await startDeepReadingAction({ castingId: props.castingId, turnstileToken: token });
      setReadingResetKey((value) => value + 1);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPolling(true);
      router.refresh();
    });
  }

  if (previewComplete && readingComplete) return null;
  if (!props.isAuthed) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--ink-2)]">Sign in to generate and reopen your fixed reading.</p>
          <Button asChild size="sm" className="mt-3">
            <Link href={`/signin?callbackURL=${encodeURIComponent(`/result/${props.castingId}`)}`}>Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
      {!previewComplete && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-display text-lg font-medium">Free fixed preview</h3>
            <p className="mt-1.5 text-sm text-[var(--ink-3)]">
              Generate the one permanent preview associated with this casting.
            </p>
            <TurnstileChallenge
              action="generate_preview"
              resetKey={previewResetKey}
              onToken={setPreviewToken}
            />
            <Button
              size="sm"
              className="mt-3"
              disabled={isPending || polling || (challengeRequired && !previewToken)}
              onClick={generatePreview}
            >
              {isPending || polling ? "Generating…" : "Generate preview"}
            </Button>
          </CardContent>
        </Card>
      )}
      {!readingComplete && (
        <div className="rounded-lg bg-[#221c12] p-6 text-[#f0e7d2]">
          <h3 className="font-display text-lg font-medium">Deep reading</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#c9bb9c]">
            Ten validated modules tied to the immutable casting snapshot. Generation consumes one credit only after successful delivery.
          </p>
          <TurnstileChallenge
            action="generate_reading"
            resetKey={readingResetKey}
            onToken={setReadingToken}
          />
          <div className="mt-4 flex items-center gap-4">
            <Button
              size="sm"
              disabled={isPending || polling || (challengeRequired && !readingToken)}
              onClick={generateReading}
            >
              {isPending || polling ? "Generating…" : "Use 1 credit"}
            </Button>
            <Link href="/pricing" className="text-sm font-medium text-[#d9a95c] hover:underline">
              Need credits?
            </Link>
          </div>
        </div>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)] md:col-span-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
''',
)
replace_once(
    "src/app/result/[castingId]/page.tsx",
    'import { DeleteCastButton } from "@/components/cast/delete-cast-button";',
    'import { DeleteCastButton } from "@/components/cast/delete-cast-button";\nimport { ResultReadingControls } from "@/components/cast/result-reading-controls";',
)
replace_once(
    "src/app/result/[castingId]/page.tsx",
    '''      <HexagramDisplay
        lineValues={r.lineValues}
        primaryName={r.primaryName}
        primaryNumber={r.primaryHexagramNumber}
        movingLinePositions={r.movingLinePositions}
        relatingName={r.relatingName}
        relatingNumber={r.relatingHexagramNumber}
        algorithmVersion={r.algorithmVersion}
        classicMappingVersion={r.classicMappingVersion}
      />

      {view.preview?.relevanceStatement && (''',
    '''      <HexagramDisplay
        lineValues={r.lineValues}
        primaryName={r.primaryName}
        primaryNumber={r.primaryHexagramNumber}
        movingLinePositions={r.movingLinePositions}
        relatingName={r.relatingName}
        relatingNumber={r.relatingHexagramNumber}
        algorithmVersion={r.algorithmVersion}
        classicMappingVersion={r.classicMappingVersion}
      />

      <ResultReadingControls
        castingId={castingId}
        isAuthed={view.isAuthed}
        previewStatus={view.preview?.status ?? null}
        readingStatus={view.reading?.status ?? null}
      />

      {view.preview?.relevanceStatement && (''',
)

# Tests for source boundaries and PostgreSQL reveal behavior.
replace_once(
    "src/app/production-action-boundaries.test.ts",
    '''  it("hashes direct production and privacy rate-limit identities before database persistence", async () => {''',
    '''  it("creates a durable anonymous owner and uses the authenticated reveal service", async () => {
    const production = await source("src/app/production-actions.ts");
    const resultPage = await source("src/app/result/[castingId]/page.tsx");
    expect(production).toContain("getOrCreateAnonymousHash");
    expect(production).toContain("owner({ createAnonymous: true })");
    expect(production).toContain("PostgresAuthenticatedRevealService");
    expect(resultPage).toContain("ResultReadingControls");
  });

  it("hashes direct production and privacy rate-limit identities before database persistence", async () => {''',
)
replace_once(
    "src/server/runtime/postgres-reveal-handoff.integration.test.ts",
    'import { PostgresRevealHandoffService } from "./postgres-reveal-handoff";',
    'import { PostgresRevealHandoffService } from "./postgres-reveal-handoff";\nimport { PostgresAuthenticatedRevealService } from "./postgres-authenticated-reveal";',
)
replace_once(
    "src/server/runtime/postgres-reveal-handoff.integration.test.ts",
    '''  function handoffService() {
    return new PostgresRevealHandoffService({
      sql,
      clock: { now: () => new Date(current.value) },
    });
  }
''',
    '''  function handoffService() {
    return new PostgresRevealHandoffService({
      sql,
      clock: { now: () => new Date(current.value) },
    });
  }

  function authenticatedRevealService() {
    return new PostgresAuthenticatedRevealService({
      sql,
      clock: { now: () => new Date(current.value) },
    });
  }
''',
)
replace_once(
    "src/server/runtime/postgres-reveal-handoff.integration.test.ts",
    '''  beforeAll(async () => {''',
    '''  async function completedUserCasting(userId: string) {
    const runtime = application();
    const draft = await runtime.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_should_i_pay_attention_to_next",
      userId,
      anonymousSessionHash: null,
    });
    await runtime.submitQuestion({
      castingId: draft.castingId,
      userId,
      anonymousSessionHash: null,
      context: "I need to understand how to approach a delayed role decision without forcing the outcome.",
    });
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await runtime.recordCoinLine({
        castingId: draft.castingId,
        userId,
        anonymousSessionHash: null,
        lineIndex: lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
      });
    }
    return draft.castingId;
  }

  beforeAll(async () => {''',
)
replace_once(
    "src/server/runtime/postgres-reveal-handoff.integration.test.ts",
    '''  it("reveals from a new browser using only opaque state and the authenticated identity", async () => {''',
    '''  it("reveals a casting created by an authenticated user without an anonymous cookie", async () => {
    await sql`insert into users (id, email) values ('usr_owner', 'owner@example.com')`;
    const castingId = await completedUserCasting("usr_owner");

    await expect(authenticatedRevealService().reveal({
      castingId,
      authenticatedUserId: "usr_owner",
      anonymousSessionHash: null,
    })).resolves.toEqual({ revealed: true, duplicate: false, castingId });

    const rows = await sql`
      select user_id, anonymous_session_hash, lifecycle from casting_sessions where id = ${castingId}
    `;
    expect(rows[0]).toMatchObject({
      user_id: "usr_owner",
      anonymous_session_hash: null,
      lifecycle: "revealed",
    });
  });

  it("binds an anonymous casting when its browser session is already signed in", async () => {
    const castingId = await completedCasting("anon-already-signed-in");
    await sql`insert into users (id, email) values ('usr_owner', 'owner@example.com')`;

    await expect(authenticatedRevealService().reveal({
      castingId,
      authenticatedUserId: "usr_owner",
      anonymousSessionHash: "anon-already-signed-in",
    })).resolves.toEqual({ revealed: true, duplicate: false, castingId });

    const rows = await sql`
      select user_id, anonymous_session_hash, lifecycle from casting_sessions where id = ${castingId}
    `;
    expect(rows[0]).toMatchObject({
      user_id: "usr_owner",
      anonymous_session_hash: null,
      lifecycle: "revealed",
    });
  });

  it("reveals from a new browser using only opaque state and the authenticated identity", async () => {''',
)

print("Production blocker remediation patch applied.")
