import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

export type AuditCategory =
  | "checkout"
  | "webhook"
  | "entitlement"
  | "generation"
  | "reconcile"
  | "deletion"
  | "capability";

export type AuditEventInput = {
  category: AuditCategory;
  action: string;
  entityType: string;
  entityId?: string | null;
  userId?: string | null;
  payload?: Record<string, unknown>;
};

export interface AuditService {
  recordAuditEvent(event: AuditEventInput): Promise<void>;
}

const REDACTED_KEYS = new Set([
  "password",
  "secret",
  "key",
  "apikey",
  "token",
  "cardnumber",
  "cvv",
  "signature",
  "questiontext",
  "authorization",
]);

export function sanitizeAuditPayload(payload: Record<string, unknown> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(payload)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, "");
    if (REDACTED_KEYS.has(lowerKey)) {
      result[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      result[k] = sanitizeAuditPayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }

  return result;
}

export function createAuditService(dependencies: { sql: Sql }): AuditService {
  const { sql } = dependencies;

  return {
    async recordAuditEvent(event): Promise<void> {
      try {
        const sanitized = sanitizeAuditPayload(event.payload ?? {});
        await sql`
          insert into audit_events (
            id, category, action, entity_type, entity_id, user_id, payload, created_at
          ) values (
            ${randomUUID()}, ${event.category}, ${event.action}, ${event.entityType},
            ${event.entityId ?? null}, ${event.userId ?? null},
            ${JSON.stringify(sanitized)}::jsonb, clock_timestamp()
          )
        `;
      } catch (error) {
        // Audit recording should not crash business critical flows
        console.error("Failed to record audit event:", error);
      }
    },
  };
}
