import { describe, expect, it } from "vitest";
import {
  classifyAppliedMigrationHistory,
  classifyMigration0012Schema,
  MIGRATION_0012_REQUIRED_OBJECTS,
} from "./production-schema-release";

describe("Production Drizzle schema release preflight", () => {
  it("treats a completely absent migration 0012 schema as pending", () => {
    expect(classifyMigration0012Schema([])).toEqual({
      state: "pending",
      present: [],
      missing: [...MIGRATION_0012_REQUIRED_OBJECTS],
    });
  });

  it("treats all migration 0012 objects present as complete", () => {
    expect(classifyMigration0012Schema([...MIGRATION_0012_REQUIRED_OBJECTS])).toEqual({
      state: "complete",
      present: [...MIGRATION_0012_REQUIRED_OBJECTS],
      missing: [],
    });
  });

  it("identifies partial schema as unsafe for automatic migration", () => {
    const state = classifyMigration0012Schema(MIGRATION_0012_REQUIRED_OBJECTS.slice(1));
    expect(state.state).toBe("partial");
    expect(state.present).toHaveLength(MIGRATION_0012_REQUIRED_OBJECTS.length - 1);
    expect(state.missing).toEqual(["table:question_locks"]);
  });

  it("allows only the exact journal prefix before migration 0012", () => {
    const expected = [
      { createdAt: 10, hash: "migration-one" },
      { createdAt: 20, hash: "migration-two" },
      { createdAt: 30, hash: "migration-twelve" },
    ];

    expect(classifyAppliedMigrationHistory(expected.slice(0, -1), expected)).toBe("pending");
    expect(classifyAppliedMigrationHistory(expected, expected)).toBe("complete");
    expect(classifyAppliedMigrationHistory([{ createdAt: 10, hash: "unexpected" }], expected)).toBe("invalid");
    expect(classifyAppliedMigrationHistory(expected.slice(0, 1), expected)).toBe("invalid");
  });
});
