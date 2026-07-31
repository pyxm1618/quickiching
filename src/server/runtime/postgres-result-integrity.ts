import type { Sql } from "postgres";
import { serializeCastResultIntegrity } from "@/domain/casting/result-integrity";
import type { CastingMethod } from "@/domain/casting/types";
import { hmac, hmacMatches } from "@/lib/crypto";
import { runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("CAST_RESULT_CANONICALIZATION_INVALID");
  return value.map(Number);
}

function integrityFailure(): never {
  throw new DomainError(
    "CAST_RESULT_INTEGRITY_FAILED",
    "The casting result failed integrity verification.",
    false,
  );
}

export class PostgresResultIntegrityService {
  constructor(private readonly sql: Sql) {}

  async seal(castingId: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx`
        select c.id, c.method,
          r.line_values, r.primary_hexagram_number, r.moving_line_positions,
          r.relating_hexagram_number, r.method_calculation,
          r.algorithm_version, r.classic_mapping_version,
          r.result_hmac, r.result_hmac_key_version
        from casting_sessions c
        join cast_results r on r.casting_session_id = c.id
        where c.id = ${castingId}
        for update of r
      `;
      const row = rows[0];
      if (!row) integrityFailure();
      const serialized = this.serializedOrFail(row);

      if (row.result_hmac_key_version) {
        if (!this.matches(row, serialized)) integrityFailure();
        return;
      }

      const keyVersion = runtimeConfig().keys.resultIntegrity.writeVersion;
      const signature = hmac(serialized, "result", keyVersion);
      await tx`
        update cast_results set
          result_hmac = ${signature}, result_hmac_key_version = ${keyVersion}
        where casting_session_id = ${castingId}
          and result_hmac_key_version is null
      `;
    });
  }

  async assertValid(castingId: string): Promise<void> {
    const rows = await this.resultRowsForCasting(castingId);
    const row = rows[0];
    if (!row || !row.result_hmac || !row.result_hmac_key_version) integrityFailure();
    const serialized = this.serializedOrFail(row);
    if (!this.matches(row, serialized)) integrityFailure();
  }

  async assertIntentValid(intentId: string): Promise<void> {
    const rows = await this.sql`
      select casting_session_id from login_intents where id = ${intentId}
    `;
    if (!rows[0]) integrityFailure();
    await this.assertValid(String(rows[0].casting_session_id));
  }

  private resultRowsForCasting(castingId: string) {
    return this.sql`
      select c.id, c.method,
        r.line_values, r.primary_hexagram_number, r.moving_line_positions,
        r.relating_hexagram_number, r.method_calculation,
        r.algorithm_version, r.classic_mapping_version,
        r.result_hmac, r.result_hmac_key_version
      from casting_sessions c
      join cast_results r on r.casting_session_id = c.id
      where c.id = ${castingId}
    `;
  }

  private matches(row: Record<string, unknown>, serialized: string): boolean {
    return Boolean(
      row.result_hmac
      && row.result_hmac_key_version
      && hmacMatches(
        serialized,
        String(row.result_hmac),
        "result",
        String(row.result_hmac_key_version),
      )
    );
  }

  private serializedOrFail(row: Record<string, unknown>): string {
    try {
      return this.serialize(row);
    } catch {
      return integrityFailure();
    }
  }

  private serialize(row: Record<string, unknown>): string {
    return serializeCastResultIntegrity({
      castingSessionId: String(row.id),
      method: String(row.method) as CastingMethod,
      lineValues: asNumberArray(row.line_values),
      primaryHexagramNumber: Number(row.primary_hexagram_number),
      movingLinePositions: asNumberArray(row.moving_line_positions),
      relatingHexagramNumber: row.relating_hexagram_number == null
        ? null
        : Number(row.relating_hexagram_number),
      methodCalculation: row.method_calculation,
      algorithmVersion: String(row.algorithm_version),
      classicMappingVersion: String(row.classic_mapping_version),
    });
  }
}
