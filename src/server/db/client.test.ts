import { describe, expect, it } from "vitest";
import { getAuthDatabaseConnection, getCommercialDatabaseConnection } from "./client";

describe("runtime PostgreSQL client sharing", () => {
  it("shares one underlying postgres client for the same runtime DATABASE_URL", () => {
    const url = "postgresql://runtime-sharing.invalid/quickiching";
    expect(getAuthDatabaseConnection(url).client).toBe(getCommercialDatabaseConnection(url).client);
  });
});
