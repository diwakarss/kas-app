import {
  tokenize,
  parse,
  evaluate,
  extractFieldRefs,
  FormulaContext,
  FormulaError,
  TokenType,
} from "../../src/engines/formula-parser";

describe("Formula Parser — Tokenizer", () => {
  test("tokenizes number", () => {
    const tokens = tokenize("42");
    expect(tokens[0]).toEqual({ type: TokenType.NUMBER, value: "42", position: 0 });
  });

  test("tokenizes decimal number", () => {
    const tokens = tokenize("3.14");
    expect(tokens[0]).toEqual({ type: TokenType.NUMBER, value: "3.14", position: 0 });
  });

  test("tokenizes identifier", () => {
    const tokens = tokenize("hourly_fee");
    expect(tokens[0]).toEqual({ type: TokenType.IDENTIFIER, value: "hourly_fee", position: 0 });
  });

  test("tokenizes operators", () => {
    const tokens = tokenize("+ - * /");
    expect(tokens[0].type).toBe(TokenType.PLUS);
    expect(tokens[1].type).toBe(TokenType.MINUS);
    expect(tokens[2].type).toBe(TokenType.STAR);
    expect(tokens[3].type).toBe(TokenType.SLASH);
  });

  test("tokenizes parentheses and dot", () => {
    const tokens = tokenize("(a.b)");
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.LPAREN,
      TokenType.IDENTIFIER,
      TokenType.DOT,
      TokenType.IDENTIFIER,
      TokenType.RPAREN,
      TokenType.EOF,
    ]);
  });

  test("throws on unexpected character", () => {
    expect(() => tokenize("a @ b")).toThrow(FormulaError);
  });
});

describe("Formula Parser — AST", () => {
  test("parses number literal", () => {
    const ast = parse("42");
    expect(ast).toEqual({ kind: "number", value: 42 });
  });

  test("parses field reference", () => {
    const ast = parse("hourly_fee");
    expect(ast).toEqual({ kind: "field_ref", name: "hourly_fee" });
  });

  test("parses cross-entity reference", () => {
    const ast = parse("student.hourly_fee");
    expect(ast).toEqual({ kind: "cross_entity_ref", entity: "student", field: "hourly_fee" });
  });

  test("parses addition", () => {
    const ast = parse("a + b");
    expect(ast).toEqual({
      kind: "binary_op",
      op: "+",
      left: { kind: "field_ref", name: "a" },
      right: { kind: "field_ref", name: "b" },
    });
  });

  test("parses multiplication", () => {
    const ast = parse("a * b");
    expect(ast).toEqual({
      kind: "binary_op",
      op: "*",
      left: { kind: "field_ref", name: "a" },
      right: { kind: "field_ref", name: "b" },
    });
  });

  test("respects operator precedence: * before +", () => {
    const ast = parse("a + b * c");
    expect(ast.kind).toBe("binary_op");
    if (ast.kind === "binary_op") {
      expect(ast.op).toBe("+");
      expect(ast.right.kind).toBe("binary_op");
    }
  });

  test("parses parenthesized expression", () => {
    const ast = parse("(a + b) * c");
    expect(ast.kind).toBe("binary_op");
    if (ast.kind === "binary_op") {
      expect(ast.op).toBe("*");
      expect(ast.left.kind).toBe("binary_op");
    }
  });

  test("parses unary minus", () => {
    const ast = parse("-a");
    expect(ast).toEqual({ kind: "unary_minus", operand: { kind: "field_ref", name: "a" } });
  });

  test("parses complex formula from tutor spec", () => {
    // total_earned = total_classes * hourly_fee
    const ast = parse("total_classes * hourly_fee");
    expect(ast.kind).toBe("binary_op");
  });

  test("parses subtraction formula from tutor spec", () => {
    // due_amount = total_earned - total_paid
    const ast = parse("total_earned - total_paid");
    expect(ast.kind).toBe("binary_op");
    if (ast.kind === "binary_op") {
      expect(ast.op).toBe("-");
    }
  });

  test("parses Class earnings formula with cross-entity ref", () => {
    // earnings = (duration / 60) * student.hourly_fee
    const ast = parse("(duration / 60) * student.hourly_fee");
    expect(ast.kind).toBe("binary_op");
  });
});

describe("Formula Parser — Evaluator", () => {
  const simpleContext: FormulaContext = {
    fields: { a: 10, b: 5, c: 3 },
    resolveEntityField: () => null,
  };

  test("evaluates number literal", () => {
    expect(evaluate(parse("42"), simpleContext)).toBe(42);
  });

  test("evaluates field reference", () => {
    expect(evaluate(parse("a"), simpleContext)).toBe(10);
  });

  test("evaluates addition", () => {
    expect(evaluate(parse("a + b"), simpleContext)).toBe(15);
  });

  test("evaluates subtraction", () => {
    expect(evaluate(parse("a - b"), simpleContext)).toBe(5);
  });

  test("evaluates multiplication", () => {
    expect(evaluate(parse("a * b"), simpleContext)).toBe(50);
  });

  test("evaluates division", () => {
    expect(evaluate(parse("a / b"), simpleContext)).toBe(2);
  });

  test("respects operator precedence: 2 + 3 * 4 = 14", () => {
    const ctx: FormulaContext = { fields: {}, resolveEntityField: () => null };
    expect(evaluate(parse("2 + 3 * 4"), ctx)).toBe(14);
  });

  test("respects parentheses: (2 + 3) * 4 = 20", () => {
    const ctx: FormulaContext = { fields: {}, resolveEntityField: () => null };
    expect(evaluate(parse("(2 + 3) * 4"), ctx)).toBe(20);
  });

  test("evaluates unary minus", () => {
    expect(evaluate(parse("-a"), simpleContext)).toBe(-10);
  });

  test("null propagation: null operand → null result", () => {
    const ctx: FormulaContext = {
      fields: { a: 10, b: null },
      resolveEntityField: () => null,
    };
    expect(evaluate(parse("a + b"), ctx)).toBeNull();
  });

  test("null propagation: missing field → null result", () => {
    const ctx: FormulaContext = {
      fields: { a: 10 },
      resolveEntityField: () => null,
    };
    expect(evaluate(parse("a + missing"), ctx)).toBeNull();
  });

  test("division by zero → null", () => {
    const ctx: FormulaContext = {
      fields: { a: 10, b: 0 },
      resolveEntityField: () => null,
    };
    expect(evaluate(parse("a / b"), ctx)).toBeNull();
  });

  test("cross-entity field resolution", () => {
    const ctx: FormulaContext = {
      fields: { duration: 90 },
      resolveEntityField: (entity, field) => {
        if (entity === "student" && field === "hourly_fee") return 500;
        return null;
      },
    };
    // (duration / 60) * student.hourly_fee = (90/60) * 500 = 750
    expect(evaluate(parse("(duration / 60) * student.hourly_fee"), ctx)).toBe(750);
  });

  test("chained formula: total_earned = total_classes * hourly_fee", () => {
    const ctx: FormulaContext = {
      fields: { total_classes: 10, hourly_fee: 500 },
      resolveEntityField: () => null,
    };
    expect(evaluate(parse("total_classes * hourly_fee"), ctx)).toBe(5000);
  });

  test("chained formula: due_amount = total_earned - total_paid", () => {
    const ctx: FormulaContext = {
      fields: { total_earned: 5000, total_paid: 4000 },
      resolveEntityField: () => null,
    };
    expect(evaluate(parse("total_earned - total_paid"), ctx)).toBe(1000);
  });
});

describe("Formula Parser — extractFieldRefs", () => {
  test("extracts direct field refs", () => {
    const refs = extractFieldRefs("total_classes * hourly_fee");
    expect(refs.direct).toContain("total_classes");
    expect(refs.direct).toContain("hourly_fee");
  });

  test("extracts cross-entity refs", () => {
    const refs = extractFieldRefs("(duration / 60) * student.hourly_fee");
    expect(refs.crossEntity).toEqual([{ entity: "student", field: "hourly_fee" }]);
    expect(refs.direct).toContain("duration");
  });

  test("handles formula with no refs (just numbers)", () => {
    const refs = extractFieldRefs("2 + 3");
    expect(refs.direct).toHaveLength(0);
    expect(refs.crossEntity).toHaveLength(0);
  });
});
