import { generateDDL, mapFieldType } from "../../src/engines/schema-engine";
import type { KASAppSpec, Entity } from "../../src/core/types/spec";

// Helper: build a minimal spec with given entities
function makeSpec(entities: Entity[]): KASAppSpec {
  return {
    meta: {
      spec_id: "test-001",
      name: "Test",
      version: 1,
      business_type: "test",
      created_date: "2026-01-01",
      base_template: "test-v1",
      source: "template",
      generation_confidence: 0.9,
      version_history: [],
      customizations: [],
    },
    entities,
    anchor: {} as any,
    story_events: {},
    add_flows: {},
    search: { entities: [], display: {} },
    calendar: {} as any,
    chat_commands: [],
    business_rules: [],
    computed_fields: {},
  };
}

describe("Schema Engine — mapFieldType", () => {
  test("maps text types to TEXT", () => {
    expect(mapFieldType("text")).toBe("TEXT");
    expect(mapFieldType("note")).toBe("TEXT");
    expect(mapFieldType("phone")).toBe("TEXT");
    expect(mapFieldType("email")).toBe("TEXT");
    expect(mapFieldType("choice")).toBe("TEXT");
    expect(mapFieldType("image")).toBe("TEXT");
  });

  test("maps date/time types to TEXT", () => {
    expect(mapFieldType("date")).toBe("TEXT");
    expect(mapFieldType("datetime")).toBe("TEXT");
    expect(mapFieldType("time")).toBe("TEXT");
  });

  test("maps number to INTEGER", () => {
    expect(mapFieldType("number")).toBe("INTEGER");
  });

  test("maps currency to REAL", () => {
    expect(mapFieldType("currency")).toBe("REAL");
  });

  test("maps toggle to INTEGER", () => {
    expect(mapFieldType("toggle")).toBe("INTEGER");
  });

  test("maps duration to INTEGER", () => {
    expect(mapFieldType("duration")).toBe("INTEGER");
  });
});

describe("Schema Engine — generateDDL", () => {
  test("generates CREATE TABLE with system columns", () => {
    const spec = makeSpec([
      {
        name: "Student",
        display_name: "Student",
        display_name_plural: "Students",
        icon: "🎓",
        fields: [
          { name: "name", display_name: "Name", type: "text", required: true, searchable: true },
        ],
        relationships: [],
      },
    ]);
    const ddl = generateDDL(spec);
    const createTable = ddl.find((s) => s.includes("CREATE TABLE") && s.includes("student"));
    expect(createTable).toBeDefined();
    expect(createTable).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(createTable).toContain("name TEXT");
    expect(createTable).toContain("created_at TEXT");
    expect(createTable).toContain("updated_at TEXT");
    expect(createTable).toContain("archived INTEGER DEFAULT 0");
  });

  test("generates FTS5 table for searchable fields", () => {
    const spec = makeSpec([
      {
        name: "Student",
        display_name: "Student",
        display_name_plural: "Students",
        icon: "🎓",
        fields: [
          { name: "name", display_name: "Name", type: "text", required: true, searchable: true },
          { name: "phone", display_name: "Phone", type: "phone", required: false, searchable: true },
          { name: "fee", display_name: "Fee", type: "currency", required: false, searchable: false },
        ],
        relationships: [],
      },
    ]);
    const ddl = generateDDL(spec);
    const fts = ddl.find((s) => s.includes("student_fts") && s.includes("fts5"));
    expect(fts).toBeDefined();
    expect(fts).toContain("name");
    expect(fts).toContain("phone");
    expect(fts).not.toContain("fee");
  });

  test("does not generate FTS5 when no searchable fields", () => {
    const spec = makeSpec([
      {
        name: "Config",
        display_name: "Config",
        display_name_plural: "Configs",
        icon: "⚙️",
        fields: [
          { name: "key", display_name: "Key", type: "text", required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);
    const ddl = generateDDL(spec);
    expect(ddl.some((s) => s.includes("fts5"))).toBe(false);
  });

  test("generates FK columns as INTEGER with REFERENCES", () => {
    const spec = makeSpec([
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
    ]);
    const ddl = generateDDL(spec);
    const classTable = ddl.find((s) => s.includes("CREATE TABLE") && s.includes("class"));
    expect(classTable).toBeDefined();
    expect(classTable).toContain('student_id INTEGER REFERENCES "student"(id)');
  });

  test("generates FK index", () => {
    const spec = makeSpec([
      {
        name: "Student",
        display_name: "Student",
        display_name_plural: "Students",
        icon: "🎓",
        fields: [
          { name: "name", display_name: "Name", type: "text", required: true, searchable: false },
        ],
        relationships: [],
      },
      {
        name: "Class",
        display_name: "Class",
        display_name_plural: "Classes",
        icon: "📚",
        fields: [
          { name: "student_id", display_name: "Student", type: "number", required: true, searchable: false },
        ],
        relationships: [
          { target: "Student", type: "belongs_to", foreign_key: "student_id", display_in_story: false },
        ],
      },
    ]);
    const ddl = generateDDL(spec);
    expect(ddl.some((s) => s.includes("idx_class_student_id"))).toBe(true);
  });

  test("generates _events table", () => {
    const spec = makeSpec([
      {
        name: "Item",
        display_name: "Item",
        display_name_plural: "Items",
        icon: "📦",
        fields: [],
        relationships: [],
      },
    ]);
    const ddl = generateDDL(spec);
    const events = ddl.find((s) => s.includes("CREATE TABLE") && s.includes("_events"));
    expect(events).toBeDefined();
    expect(events).toContain("entity_type TEXT NOT NULL");
    expect(events).toContain("entity_id INTEGER NOT NULL");
    expect(events).toContain("event_type TEXT NOT NULL");
    expect(events).toContain("data_json TEXT");
  });

  test("generates FTS5 sync triggers (insert, update, delete)", () => {
    const spec = makeSpec([
      {
        name: "Student",
        display_name: "Student",
        display_name_plural: "Students",
        icon: "🎓",
        fields: [
          { name: "name", display_name: "Name", type: "text", required: true, searchable: true },
        ],
        relationships: [],
      },
    ]);
    const ddl = generateDDL(spec);
    expect(ddl.some((s) => s.includes("student_ai") && s.includes("AFTER INSERT"))).toBe(true);
    expect(ddl.some((s) => s.includes("student_au") && s.includes("AFTER UPDATE"))).toBe(true);
    expect(ddl.some((s) => s.includes("student_ad") && s.includes("AFTER DELETE"))).toBe(true);
  });

  test("orders tables by dependency (parent before child)", () => {
    // Deliberately list child first
    const spec = makeSpec([
      {
        name: "Class",
        display_name: "Class",
        display_name_plural: "Classes",
        icon: "📚",
        fields: [
          { name: "student_id", display_name: "Student", type: "number", required: true, searchable: false },
        ],
        relationships: [
          { target: "Student", type: "belongs_to", foreign_key: "student_id", display_in_story: false },
        ],
      },
      {
        name: "Student",
        display_name: "Student",
        display_name_plural: "Students",
        icon: "🎓",
        fields: [
          { name: "name", display_name: "Name", type: "text", required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);
    const ddl = generateDDL(spec);
    const creates = ddl.filter((s) => s.startsWith("CREATE TABLE"));
    const studentIdx = creates.findIndex((s) => s.includes('"student"'));
    const classIdx = creates.findIndex((s) => s.includes('"class"'));
    expect(studentIdx).toBeLessThan(classIdx);
  });

  test("uses IF NOT EXISTS for idempotent DDL", () => {
    const spec = makeSpec([
      {
        name: "Item",
        display_name: "Item",
        display_name_plural: "Items",
        icon: "📦",
        fields: [
          { name: "title", display_name: "Title", type: "text", required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);
    const ddl = generateDDL(spec);
    for (const stmt of ddl) {
      if (stmt.includes("CREATE")) {
        expect(stmt).toContain("IF NOT EXISTS");
      }
    }
  });

  test("generates complete DDL for tutor-like spec (4 entities)", () => {
    const spec = makeSpec([
      {
        name: "Student",
        display_name: "Student",
        display_name_plural: "Students",
        icon: "🎓",
        fields: [
          { name: "name", display_name: "Name", type: "text", required: true, searchable: true },
          { name: "hourly_fee", display_name: "Fee", type: "currency", required: true, searchable: false },
        ],
        relationships: [
          { target: "Class", type: "has_many", foreign_key: "student_id", display_in_story: true },
          { target: "Payment", type: "has_many", foreign_key: "student_id", display_in_story: true },
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
          { name: "status", display_name: "Status", type: "choice", required: true, searchable: false },
        ],
        relationships: [
          { target: "Student", type: "belongs_to", foreign_key: "student_id", display_in_story: false },
        ],
      },
      {
        name: "Payment",
        display_name: "Payment",
        display_name_plural: "Payments",
        icon: "💰",
        fields: [
          { name: "student_id", display_name: "Student", type: "number", required: true, searchable: false },
          { name: "amount", display_name: "Amount", type: "currency", required: true, searchable: false },
          { name: "date", display_name: "Date", type: "date", required: true, searchable: false },
        ],
        relationships: [
          { target: "Student", type: "belongs_to", foreign_key: "student_id", display_in_story: false },
        ],
      },
      {
        name: "Note",
        display_name: "Note",
        display_name_plural: "Notes",
        icon: "📝",
        fields: [
          { name: "student_id", display_name: "Student", type: "number", required: true, searchable: false },
          { name: "content", display_name: "Content", type: "note", required: true, searchable: true },
        ],
        relationships: [
          { target: "Student", type: "belongs_to", foreign_key: "student_id", display_in_story: false },
        ],
      },
    ]);
    const ddl = generateDDL(spec);
    // Should have: 4 CREATE TABLE + indexes + FTS + triggers + _events + event indexes
    expect(ddl.length).toBeGreaterThan(10);
    // All 4 entity tables
    expect(ddl.some((s) => s.includes("CREATE TABLE") && s.includes("student"))).toBe(true);
    expect(ddl.some((s) => s.includes("CREATE TABLE") && s.includes("class"))).toBe(true);
    expect(ddl.some((s) => s.includes("CREATE TABLE") && s.includes("payment"))).toBe(true);
    expect(ddl.some((s) => s.includes("CREATE TABLE") && s.includes("note"))).toBe(true);
    // _events table
    expect(ddl.some((s) => s.includes("_events"))).toBe(true);
  });
});
