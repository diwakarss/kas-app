import {
  formatDateValue,
  humanizeDateStrings,
} from "../../src/lib/format-dates";

describe("formatDateValue", () => {
  test("formats datetime ISO to local-friendly", () => {
    const out = formatDateValue("2026-04-28T03:30:00.000Z", "datetime");
    expect(out).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(out).toMatch(/2026/);
  });

  test("formats date-only to local-friendly", () => {
    const out = formatDateValue("2026-04-28", "date");
    expect(out).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out).toMatch(/Apr|2026/);
  });

  test("formats SQL timestamp string", () => {
    const out = formatDateValue("2026-04-28 10:03:59", "datetime");
    expect(out).not.toMatch(/^\d{4}-\d{2}-\d{2}\s/);
    expect(out).toMatch(/2026/);
  });

  test("passes through non-date strings", () => {
    expect(formatDateValue("Scheduled", "choice")).toBe("Scheduled");
    expect(formatDateValue("Asha Kumar", "text")).toBe("Asha Kumar");
  });

  test("handles null/empty", () => {
    expect(formatDateValue(null)).toBe("");
    expect(formatDateValue(undefined)).toBe("");
  });
});

describe("humanizeDateStrings", () => {
  test("replaces ISO datetime inside a templated string", () => {
    const out = humanizeDateStrings("Lesson: 2026-04-28T03:30:00.000Z");
    expect(out).toMatch(/^Lesson: /);
    expect(out).not.toMatch(/T\d{2}:\d{2}/);
    expect(out).toMatch(/2026/);
  });

  test("replaces SQL-style timestamp inside a templated string", () => {
    const out = humanizeDateStrings("Created on 2026-04-28 10:03:59");
    expect(out).toMatch(/^Created on /);
    expect(out).not.toMatch(/\s\d{2}:\d{2}:\d{2}/);
  });

  test("replaces bare date inside a templated string", () => {
    const out = humanizeDateStrings("Visit on 2026-04-28");
    expect(out).not.toMatch(/2026-04-28$/);
  });

  test("leaves non-date text alone", () => {
    expect(humanizeDateStrings("Asha Kumar — Piano")).toBe(
      "Asha Kumar — Piano",
    );
    expect(humanizeDateStrings("")).toBe("");
  });

  test("handles multiple ISO strings in one input", () => {
    const out = humanizeDateStrings(
      "From 2026-04-28T09:00:00Z to 2026-04-28T10:00:00Z",
    );
    expect(out).not.toMatch(/T09:00:00Z/);
    expect(out).not.toMatch(/T10:00:00Z/);
  });
});
