import type { Sql } from "postgres";
import type { CastingMethod, LineValue } from "@/domain/casting/types";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { HexagramResult } from "@/domain/casting/types";
import { readingReportV2Schema, type CommercialReadingReportV2 } from "@/domain/generation/schemas";
import { resolveCommercialCapabilities } from "@/server/capabilities";
import { getCommercialDatabaseConnection } from "@/server/db/client";

type RuntimeEnv = Record<string, string | undefined>;
type Row = Record<string, unknown>;

export type CastOrigin = "server_generated" | "client_attested";

export type ReadingPageView = {
  castingId: string;
  method: CastingMethod;
  scene: string;
  interpretationGoal: string;
  castOrigin: CastOrigin;
  riskStatus: string;
  createdAt: Date;
  /** Recomputed from the stored line values rather than read from the stored numbers. */
  facts: HexagramResult;
  /**
   * A finished report, when one exists. Parsed against the schema here: a row
   * that does not validate is reported as unreadable rather than rendered
   * half-blank, so a schema drift cannot quietly become missing sections.
   */
  deepReading:
    | { state: "none" }
    | { state: "ready"; report: CommercialReadingReportV2 }
    | { state: "unreadable" };
};

export interface ReadingPageReader {
  /** Reads one casting the given user owns, or null. Ownership is part of the query. */
  readForUser(userId: string, castingId: string): Promise<ReadingPageView | null>;
}

function lineValues(value: unknown): LineValue[] | null {
  if (!Array.isArray(value) || value.length !== 6) return null;
  const parsed = value.map(Number);
  return parsed.every((line) => line === 6 || line === 7 || line === 8 || line === 9)
    ? (parsed as LineValue[])
    : null;
}

function castOrigin(value: unknown): CastOrigin {
  return String(value) === "client_attested" ? "client_attested" : "server_generated";
}

export function createReadingPageReader(dependencies: { sql: Sql }): ReadingPageReader {
  const { sql } = dependencies;

  return {
    async readForUser(userId, castingId) {
      const rows = await sql`
        select c.id, c.method, c.scene, c.interpretation_goal, c.cast_origin, c.risk_status,
               c.created_at, r.line_values, r.algorithm_version, r.classic_mapping_version,
               d.output as deep_reading_output
        from casting_sessions c
        join cast_results r on r.casting_id = c.id
        left join deep_reading_results d on d.casting_id = c.id
        where c.id = ${castingId} and c.user_id = ${userId} and c.deleted_at is null
        limit 1
      ` as Row[];

      const row = rows[0];
      if (!row) return null;

      const lines = lineValues(row.line_values);
      // A stored result we cannot recompute from is a real inconsistency, not
      // something to paper over with a partial page.
      if (!lines) return null;

      const facts = buildHexagramResult({
        lineValuesBottomUp: lines,
        method: String(row.method) as CastingMethod,
        algorithmVersion: String(row.algorithm_version),
      });

      let deepReading: ReadingPageView["deepReading"] = { state: "none" };
      if (row.deep_reading_output != null) {
        const parsed = readingReportV2Schema.safeParse(row.deep_reading_output);
        deepReading = parsed.success
          ? { state: "ready", report: parsed.data }
          : { state: "unreadable" };
      }

      return {
        castingId: String(row.id),
        method: String(row.method) as CastingMethod,
        scene: String(row.scene),
        interpretationGoal: String(row.interpretation_goal),
        castOrigin: castOrigin(row.cast_origin),
        riskStatus: String(row.risk_status),
        createdAt: new Date(String(row.created_at)),
        facts,
        deepReading,
      };
    },
  };
}

export async function createProductionReadingPageReader(
  env: RuntimeEnv = process.env,
): Promise<ReadingPageReader> {
  const capabilities = resolveCommercialCapabilities(env, { production: env.NODE_ENV === "production" });
  if (!capabilities.capabilities.paidDeepReading.enabled) {
    throw new Error("PAID_DEEP_READING_DISABLED");
  }
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");
  const { client } = getCommercialDatabaseConnection(databaseUrl);
  return createReadingPageReader({ sql: client });
}
