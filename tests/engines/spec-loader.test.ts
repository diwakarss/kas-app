import { loadSpec } from "../../src/engines/spec-loader";

// Minimal valid spec factory
function makeValidSpec(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    meta: {
      spec_id: "test-001",
      name: "Test App",
      version: 1,
      business_type: "test",
      created_date: "2026-01-01",
      base_template: "test-v1",
      source: "template",
      generation_confidence: 0.9,
      version_history: [],
      customizations: [],
    },
    entities: [
      {
        name: "Item",
        display_name: "Item",
        display_name_plural: "Items",
        icon: "📦",
        fields: [
          { name: "title", display_name: "Title", type: "text", required: true, searchable: true },
        ],
        relationships: [],
      },
    ],
    anchor: {
      type: "active_list",
      entity: "Item",
      greeting_template: "Hello",
      date_label: "today",
      card_display: { title: "{title}", subtitle: "", actions: [] },
      empty_state: { message: "No items" },
      summary: { stats: [] },
    },
    computed_fields: {},
    business_rules: [],
    ...overrides,
  };
}

describe("Spec Loader — loadSpec", () => {
  // ─── Happy path ───
  test("accepts a valid minimal spec", () => {
    const result = loadSpec(makeValidSpec());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.spec.meta.spec_id).toBe("test-001");
    }
  });

  test("accepts spec with multiple entities and relationships", () => {
    const spec = makeValidSpec({
      entities: [
        {
          name: "Student",
          display_name: "Student",
          display_name_plural: "Students",
          icon: "🎓",
          fields: [
            { name: "name", display_name: "Name", type: "text", required: true, searchable: true },
          ],
          relationships: [
            { target: "Class", type: "has_many", foreign_key: "student_id", display_in_story: true },
          ],
        },
        {
          name: "Class",
          display_name: "Class",
          display_name_plural: "Classes",
          icon: "📚",
          fields: [
            { name: "student_id", display_name: "Student", type: "number", required: true, searchable: false },
            { name: "subject", display_name: "Subject", type: "text", required: true, searchable: true },
          ],
          relationships: [
            { target: "Student", type: "belongs_to", foreign_key: "student_id", display_in_story: false },
          ],
        },
      ],
      anchor: {
        type: "day_schedule",
        entity: "Class",
        greeting_template: "Hello",
        date_label: "today",
        card_display: { title: "{subject}", subtitle: "", actions: [] },
        empty_state: { message: "No classes" },
        summary: { stats: [] },
      },
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(true);
  });

  // ─── Rejection: non-objects ───
  test("rejects null input", () => {
    const result = loadSpec(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain("Input must be a non-null object (not array, not primitive)");
    }
  });

  test("rejects array input", () => {
    const result = loadSpec([]);
    expect(result.success).toBe(false);
  });

  test("rejects string input", () => {
    const result = loadSpec("not a spec");
    expect(result.success).toBe(false);
  });

  // ─── Missing required sections ───
  test("reports missing required top-level sections", () => {
    const result = loadSpec({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain("Missing required section: meta");
      expect(result.errors).toContain("Missing required section: entities");
      expect(result.errors).toContain("Missing required section: anchor");
      expect(result.errors).toContain("Missing required section: computed_fields");
      expect(result.errors).toContain("Missing required section: business_rules");
    }
  });

  // ─── Meta validation ───
  test("validates meta fields", () => {
    const spec = makeValidSpec({ meta: { spec_id: 123, name: null, version: "bad" } });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("spec_id"))).toBe(true);
      expect(result.errors.some((e: string) => e.includes("meta.name"))).toBe(true);
      expect(result.errors.some((e: string) => e.includes("version"))).toBe(true);
    }
  });

  // ─── Entity validation ───
  test("rejects empty entities array", () => {
    const spec = makeValidSpec({ entities: [] });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("non-empty"))).toBe(true);
    }
  });

  test("reports invalid field types", () => {
    const spec = makeValidSpec({
      entities: [{
        name: "Bad",
        display_name: "Bad",
        display_name_plural: "Bads",
        icon: "⚠️",
        fields: [
          { name: "x", display_name: "X", type: "INVALID", required: true, searchable: false },
        ],
        relationships: [],
      }],
      anchor: { type: "active_list", entity: "Bad", greeting_template: "", date_label: "", card_display: { title: "", subtitle: "", actions: [] }, empty_state: { message: "" }, summary: { stats: [] } },
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("INVALID"))).toBe(true);
    }
  });

  test("reports duplicate entity names", () => {
    const entity = {
      name: "Dup",
      display_name: "Dup",
      display_name_plural: "Dups",
      icon: "📦",
      fields: [{ name: "x", display_name: "X", type: "text", required: true, searchable: false }],
      relationships: [],
    };
    const spec = makeValidSpec({
      entities: [entity, entity],
      anchor: { type: "active_list", entity: "Dup", greeting_template: "", date_label: "", card_display: { title: "", subtitle: "", actions: [] }, empty_state: { message: "" }, summary: { stats: [] } },
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("Duplicate"))).toBe(true);
    }
  });

  // ─── Relationship validation ───
  test("reports relationship target not found", () => {
    const spec = makeValidSpec({
      entities: [{
        name: "Lone",
        display_name: "Lone",
        display_name_plural: "Lones",
        icon: "🏝",
        fields: [{ name: "x", display_name: "X", type: "text", required: true, searchable: false }],
        relationships: [{ target: "Ghost", type: "belongs_to", foreign_key: "ghost_id", display_in_story: false }],
      }],
      anchor: { type: "active_list", entity: "Lone", greeting_template: "", date_label: "", card_display: { title: "", subtitle: "", actions: [] }, empty_state: { message: "" }, summary: { stats: [] } },
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("Ghost") && e.includes("not found"))).toBe(true);
    }
  });

  // ─── Computed field validation ───
  test("reports invalid computed field type", () => {
    const spec = makeValidSpec({
      computed_fields: {
        Item: [{ name: "bad", display_name: "Bad", type: "NOPE" }],
      },
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("NOPE"))).toBe(true);
    }
  });

  test("reports formula computed field missing formula string", () => {
    const spec = makeValidSpec({
      computed_fields: {
        Item: [{ name: "calc", display_name: "Calc", type: "formula" }],
      },
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("formula"))).toBe(true);
    }
  });

  test("reports aggregate computed field missing source_entity", () => {
    const spec = makeValidSpec({
      computed_fields: {
        Item: [{ name: "total", display_name: "Total", type: "count" }],
      },
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("source_entity"))).toBe(true);
    }
  });

  // ─── Business rules validation ───
  test("reports business rule referencing unknown entity", () => {
    const spec = makeValidSpec({
      business_rules: [{
        id: "rule-1",
        name: "Test Rule",
        entity: "Ghost",
        condition: { type: "computed_field_exceeds", field: "x", value: 10 },
        warning: { message: "Oops", severity: "warning", show_in: ["card"] },
      }],
    });
    const result = loadSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes("Ghost") && e.includes("not found"))).toBe(true);
    }
  });

  // ─── Collects ALL errors ───
  test("collects multiple errors rather than failing on first", () => {
    const result = loadSpec({ meta: "bad", entities: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(1);
    }
  });
});
