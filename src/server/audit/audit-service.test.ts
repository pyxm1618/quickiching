import { describe, expect, it, vi } from "vitest";
import { createAuditService, sanitizeAuditPayload } from "./audit-service";

describe("Audit Service Sanitization & Logging", () => {
  it("redacts sensitive fields recursively (NEG-11)", () => {
    const rawPayload = {
      orderId: "ord-123",
      amountMinor: 299,
      secret: "super-secret-password-123",
      apiKey: "sk-live-123456",
      nested: {
        token: "tok-abc",
        cardNumber: "411111111111",
        normalField: "public-value",
      },
    };

    const sanitized = sanitizeAuditPayload(rawPayload);
    expect(sanitized.secret).toBe("[REDACTED]");
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect((sanitized.nested as any).token).toBe("[REDACTED]");
    expect((sanitized.nested as any).cardNumber).toBe("[REDACTED]");
    expect((sanitized.nested as any).normalField).toBe("public-value");
    expect(sanitized.orderId).toBe("ord-123");
  });

  it("safely records audit events without throwing to callers", async () => {
    const mockSql = vi.fn().mockRejectedValue(new Error("DB_CONNECTION_LOST"));
    const service = createAuditService({ sql: mockSql as any });

    // Should not throw
    await expect(service.recordAuditEvent({
      category: "checkout",
      action: "order_created",
      entityType: "order",
      entityId: "ord-1",
      payload: { amount: 299 },
    })).resolves.toBeUndefined();
  });
});
