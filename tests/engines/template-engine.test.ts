import { resolveTemplate } from "../../src/engines/template-engine";

describe("Template Engine — resolveTemplate", () => {
  // ─── Simple field resolution ───
  test("resolves single field placeholder", () => {
    expect(resolveTemplate("{name}", { name: "Lakshmi" })).toBe("Lakshmi");
  });

  test("resolves multiple field placeholders", () => {
    expect(
      resolveTemplate("{name} - {grade}", { name: "Anu", grade: "Grade 5" })
    ).toBe("Anu - Grade 5");
  });

  test("resolves numeric field (including 0)", () => {
    expect(resolveTemplate("Rs.{amount}", { amount: 0 })).toBe("Rs.0");
    expect(resolveTemplate("Rs.{amount}", { amount: 500 })).toBe("Rs.500");
  });

  test("resolves boolean field", () => {
    expect(resolveTemplate("{active}", { active: true })).toBe("true");
  });

  // ─── Cross-entity (dot notation) ───
  test("resolves cross-entity placeholder", () => {
    const data = { name: "Class 1" };
    const related = { Student: { name: "Anu" } };
    expect(resolveTemplate("{Student.name}: {name}", data, related)).toBe(
      "Anu: Class 1"
    );
  });

  test("resolves nested dot notation entity.field", () => {
    const related = { Payment: { amount: 1500 } };
    expect(resolveTemplate("Paid: {Payment.amount}", {}, related)).toBe(
      "Paid: 1500"
    );
  });

  // ─── Null / missing handling ───
  test("missing field resolves to empty and collapses", () => {
    expect(resolveTemplate("{name} - {grade}", { name: "Anu" })).toBe("Anu");
  });

  test("null field resolves to empty and collapses", () => {
    expect(
      resolveTemplate("{name} - {grade}", { name: "Anu", grade: null })
    ).toBe("Anu");
  });

  test("undefined field resolves to empty and collapses", () => {
    expect(
      resolveTemplate("{name} - {grade}", { name: "Anu", grade: undefined })
    ).toBe("Anu");
  });

  test("empty string field resolves to empty", () => {
    expect(
      resolveTemplate("{name} - {grade}", { name: "Anu", grade: "" })
    ).toBe("Anu");
  });

  test("missing related entity resolves to empty", () => {
    expect(resolveTemplate("{Student.name}", {})).toBe("");
  });

  // ─── Separator collapse ───
  test("collapses ' - ' when left side is null", () => {
    expect(resolveTemplate("{missing} - {name}", { name: "Anu" })).toBe("Anu");
  });

  test("collapses ' - ' when right side is null", () => {
    expect(resolveTemplate("{name} - {missing}", { name: "Anu" })).toBe("Anu");
  });

  test("collapses ' - ' when both sides are null", () => {
    expect(resolveTemplate("{a} - {b}", {})).toBe("");
  });

  test("removes empty parentheses", () => {
    expect(resolveTemplate("{name} ({grade})", { name: "Anu" })).toBe("Anu");
  });

  test("collapses multiple spaces to single space", () => {
    expect(
      resolveTemplate("{a}  {b}  {c}", { a: "x", b: "y", c: "z" })
    ).toBe("x y z");
  });

  // ─── No placeholders ───
  test("returns literal text when no placeholders", () => {
    expect(resolveTemplate("Hello World", {})).toBe("Hello World");
  });

  test("returns empty string for empty template", () => {
    expect(resolveTemplate("", {})).toBe("");
  });

  // ─── Real-world spec templates ───
  test("tutor spec: anchor card title", () => {
    expect(
      resolveTemplate("{Student.name} - {subject}", {
        subject: "Veena",
      }, { Student: { name: "Anu" } })
    ).toBe("Anu - Veena");
  });

  test("tutor spec: card subtitle with time", () => {
    expect(
      resolveTemplate("{time} ({duration} min)", {
        time: "4:00 PM",
        duration: 60,
      })
    ).toBe("4:00 PM (60 min)");
  });
});
