import {
  topologicalSort,
  CircularDependencyError,
  invalidateCache,
} from "../../src/engines/computed-field-engine";
import { ComputedField } from "../../src/core/types/spec";

describe("Computed Field Engine — Topological Sort", () => {
  test("sorts independent fields (all aggregates)", () => {
    const fields: ComputedField[] = [
      { name: "total_classes", display_name: "Total Classes", type: "count", source_entity: "Class", relationship: "student_id" },
      { name: "total_paid", display_name: "Total Paid", type: "sum", source_entity: "Payment", source_field: "amount", relationship: "student_id" },
    ];
    const sorted = topologicalSort(fields);
    expect(sorted).toHaveLength(2);
    // Both have no deps, order doesn't matter
    expect(sorted.map((f) => f.name)).toContain("total_classes");
    expect(sorted.map((f) => f.name)).toContain("total_paid");
  });

  test("sorts formula that depends on aggregate", () => {
    const fields: ComputedField[] = [
      { name: "total_classes", display_name: "Total Classes", type: "count", source_entity: "Class", relationship: "student_id" },
      { name: "total_earned", display_name: "Total Earned", type: "formula", formula: "total_classes * hourly_fee" },
    ];
    const sorted = topologicalSort(fields);
    expect(sorted[0].name).toBe("total_classes");
    expect(sorted[1].name).toBe("total_earned");
  });

  test("sorts double-chained formulas correctly", () => {
    const fields: ComputedField[] = [
      { name: "total_classes", display_name: "Total Classes", type: "count", source_entity: "Class", relationship: "student_id" },
      { name: "total_paid", display_name: "Total Paid", type: "sum", source_entity: "Payment", source_field: "amount", relationship: "student_id" },
      { name: "total_earned", display_name: "Total Earned", type: "formula", formula: "total_classes * hourly_fee" },
      { name: "due_amount", display_name: "Amount Due", type: "formula", formula: "total_earned - total_paid" },
    ];
    const sorted = topologicalSort(fields);
    const names = sorted.map((f) => f.name);

    // total_classes must come before total_earned
    expect(names.indexOf("total_classes")).toBeLessThan(names.indexOf("total_earned"));
    // total_earned and total_paid must come before due_amount
    expect(names.indexOf("total_earned")).toBeLessThan(names.indexOf("due_amount"));
    expect(names.indexOf("total_paid")).toBeLessThan(names.indexOf("due_amount"));
  });

  test("handles full tutor spec Student computed fields", () => {
    const fields: ComputedField[] = [
      { name: "total_classes", display_name: "Total Classes", type: "count", source_entity: "Class", relationship: "student_id", filter: { field: "status", condition: "equals", value: "completed" } },
      { name: "total_paid", display_name: "Total Paid", type: "sum", source_entity: "Payment", source_field: "amount", relationship: "student_id" },
      { name: "total_earned", display_name: "Total Earned", type: "formula", formula: "total_classes * hourly_fee" },
      { name: "due_amount", display_name: "Amount Due", type: "formula", formula: "total_earned - total_paid" },
      { name: "days_since_last_payment", display_name: "Days Since Last Payment", type: "days_since", source_entity: "Payment", relationship: "student_id", date_field: "date" },
      { name: "upcoming_class_count", display_name: "Upcoming Classes", type: "count", source_entity: "Class", relationship: "student_id", filter: { field: "status", condition: "equals", value: "scheduled" } },
      { name: "last_class_date", display_name: "Last Class", type: "latest", source_entity: "Class", relationship: "student_id", date_field: "datetime", filter: { field: "status", condition: "equals", value: "completed" } },
    ];

    const sorted = topologicalSort(fields);
    expect(sorted).toHaveLength(7);

    const names = sorted.map((f) => f.name);
    // Verify dependency order
    expect(names.indexOf("total_classes")).toBeLessThan(names.indexOf("total_earned"));
    expect(names.indexOf("total_earned")).toBeLessThan(names.indexOf("due_amount"));
    expect(names.indexOf("total_paid")).toBeLessThan(names.indexOf("due_amount"));
  });

  test("detects circular dependency (2-node cycle)", () => {
    const fields: ComputedField[] = [
      { name: "a", display_name: "A", type: "formula", formula: "b + 1" },
      { name: "b", display_name: "B", type: "formula", formula: "a + 1" },
    ];
    expect(() => topologicalSort(fields)).toThrow(CircularDependencyError);
  });

  test("detects circular dependency (3-node cycle)", () => {
    const fields: ComputedField[] = [
      { name: "a", display_name: "A", type: "formula", formula: "c + 1" },
      { name: "b", display_name: "B", type: "formula", formula: "a + 1" },
      { name: "c", display_name: "C", type: "formula", formula: "b + 1" },
    ];
    expect(() => topologicalSort(fields)).toThrow(CircularDependencyError);
  });

  test("circular dependency error includes field names", () => {
    const fields: ComputedField[] = [
      { name: "x", display_name: "X", type: "formula", formula: "y * 2" },
      { name: "y", display_name: "Y", type: "formula", formula: "x * 2" },
    ];
    try {
      topologicalSort(fields);
      fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CircularDependencyError);
      const err = e as CircularDependencyError;
      expect(err.cycle).toContain("x");
      expect(err.cycle).toContain("y");
    }
  });
});

describe("Computed Field Engine — Cache", () => {
  test("invalidateCache clears all entries", () => {
    // Just verify it doesn't throw
    invalidateCache();
    invalidateCache("Student");
  });
});
