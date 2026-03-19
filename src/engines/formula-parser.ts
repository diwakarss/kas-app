/**
 * Formula Parser for KAS App JSON Renderer.
 *
 * A purpose-built arithmetic-only interpreter. Supports:
 * - Numbers (integer and decimal)
 * - Arithmetic operators: +, -, *, /
 * - Parentheses for grouping
 * - Unary minus
 * - Field references: hourly_fee, total_classes
 * - Cross-entity references: student.hourly_fee
 *
 * Security: NO dynamic code execution. No Function constructor.
 * No string-to-code conversion. Pure AST walking with safe
 * numeric operations only.
 *
 * Grammar (recursive descent):
 *   expression → term (('+' | '-') term)*
 *   term       → factor (('*' | '/') factor)*
 *   factor     → NUMBER | IDENTIFIER ('.' IDENTIFIER)? | '(' expression ')' | '-' factor
 */

// ===== Token Types =====

export enum TokenType {
  NUMBER = "NUMBER",
  IDENTIFIER = "IDENTIFIER",
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  DOT = "DOT",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ===== AST Node Types =====

export type ASTNode =
  | NumberNode
  | FieldRefNode
  | CrossEntityRefNode
  | BinaryOpNode
  | UnaryMinusNode;

export interface NumberNode {
  kind: "number";
  value: number;
}

export interface FieldRefNode {
  kind: "field_ref";
  name: string;
}

export interface CrossEntityRefNode {
  kind: "cross_entity_ref";
  entity: string;
  field: string;
}

export interface BinaryOpNode {
  kind: "binary_op";
  op: "+" | "-" | "*" | "/";
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryMinusNode {
  kind: "unary_minus";
  operand: ASTNode;
}

// ===== Tokenizer =====

export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < formula.length) {
    const ch = formula[pos];

    // Skip whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      pos++;
      continue;
    }

    // Number (integer or decimal)
    if (ch >= "0" && ch <= "9") {
      const start = pos;
      while (pos < formula.length && ((formula[pos] >= "0" && formula[pos] <= "9") || formula[pos] === ".")) {
        pos++;
      }
      tokens.push({ type: TokenType.NUMBER, value: formula.slice(start, pos), position: start });
      continue;
    }

    // Identifier (field name)
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      const start = pos;
      while (
        pos < formula.length &&
        ((formula[pos] >= "a" && formula[pos] <= "z") ||
          (formula[pos] >= "A" && formula[pos] <= "Z") ||
          (formula[pos] >= "0" && formula[pos] <= "9") ||
          formula[pos] === "_")
      ) {
        pos++;
      }
      tokens.push({ type: TokenType.IDENTIFIER, value: formula.slice(start, pos), position: start });
      continue;
    }

    // Single-character tokens
    switch (ch) {
      case "+":
        tokens.push({ type: TokenType.PLUS, value: "+", position: pos });
        pos++;
        continue;
      case "-":
        tokens.push({ type: TokenType.MINUS, value: "-", position: pos });
        pos++;
        continue;
      case "*":
        tokens.push({ type: TokenType.STAR, value: "*", position: pos });
        pos++;
        continue;
      case "/":
        tokens.push({ type: TokenType.SLASH, value: "/", position: pos });
        pos++;
        continue;
      case "(":
        tokens.push({ type: TokenType.LPAREN, value: "(", position: pos });
        pos++;
        continue;
      case ")":
        tokens.push({ type: TokenType.RPAREN, value: ")", position: pos });
        pos++;
        continue;
      case ".":
        tokens.push({ type: TokenType.DOT, value: ".", position: pos });
        pos++;
        continue;
      default:
        throw new FormulaError(`Unexpected character '${ch}' at position ${pos}`, pos);
    }
  }

  tokens.push({ type: TokenType.EOF, value: "", position: pos });
  return tokens;
}

// ===== Parser =====

export class FormulaError extends Error {
  constructor(
    message: string,
    public position: number
  ) {
    super(message);
    this.name = "FormulaError";
  }
}

export function parse(formula: string): ASTNode {
  const tokens = tokenize(formula);
  let current = 0;

  function peek(): Token {
    return tokens[current];
  }

  function advance(): Token {
    const token = tokens[current];
    current++;
    return token;
  }

  function expect(type: TokenType): Token {
    const token = peek();
    if (token.type !== type) {
      throw new FormulaError(
        `Expected ${type} but found ${token.type} ("${token.value}") at position ${token.position}`,
        token.position
      );
    }
    return advance();
  }

  // expression → term (('+' | '-') term)*
  function expression(): ASTNode {
    let left = term();
    while (peek().type === TokenType.PLUS || peek().type === TokenType.MINUS) {
      const op = advance().value as "+" | "-";
      const right = term();
      left = { kind: "binary_op", op, left, right };
    }
    return left;
  }

  // term → factor (('*' | '/') factor)*
  function term(): ASTNode {
    let left = factor();
    while (peek().type === TokenType.STAR || peek().type === TokenType.SLASH) {
      const op = advance().value as "*" | "/";
      const right = factor();
      left = { kind: "binary_op", op, left, right };
    }
    return left;
  }

  // factor → NUMBER | IDENTIFIER ('.' IDENTIFIER)? | '(' expression ')' | '-' factor
  function factor(): ASTNode {
    const token = peek();

    // Unary minus
    if (token.type === TokenType.MINUS) {
      advance();
      const operand = factor();
      return { kind: "unary_minus", operand };
    }

    // Number literal
    if (token.type === TokenType.NUMBER) {
      advance();
      return { kind: "number", value: parseFloat(token.value) };
    }

    // Identifier (field ref or cross-entity ref)
    if (token.type === TokenType.IDENTIFIER) {
      advance();
      const name = token.value;
      // Check for dot notation: identifier.identifier
      if (peek().type === TokenType.DOT) {
        advance(); // consume dot
        const fieldToken = expect(TokenType.IDENTIFIER);
        return { kind: "cross_entity_ref", entity: name, field: fieldToken.value };
      }
      return { kind: "field_ref", name };
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      advance();
      const expr = expression();
      expect(TokenType.RPAREN);
      return expr;
    }

    throw new FormulaError(
      `Unexpected token ${token.type} ("${token.value}") at position ${token.position}`,
      token.position
    );
  }

  const ast = expression();

  // Ensure we consumed all tokens
  if (peek().type !== TokenType.EOF) {
    const remaining = peek();
    throw new FormulaError(
      `Unexpected token ${remaining.type} ("${remaining.value}") at position ${remaining.position}`,
      remaining.position
    );
  }

  return ast;
}

// ===== Evaluator =====

/**
 * Context for formula evaluation.
 * Provides field values (direct and computed) and cross-entity lookups.
 */
export interface FormulaContext {
  /** Direct entity fields + already-computed fields */
  fields: Record<string, number | null>;
  /** Cross-entity field resolver: (entityName, fieldName) → value */
  resolveEntityField: (entity: string, field: string) => number | null;
}

/**
 * Evaluate an AST node in the given context.
 * Returns null if any operand is null (null propagation).
 */
export function evaluate(node: ASTNode, context: FormulaContext): number | null {
  switch (node.kind) {
    case "number":
      return node.value;

    case "field_ref": {
      const value = context.fields[node.name];
      return value !== undefined ? value : null;
    }

    case "cross_entity_ref":
      return context.resolveEntityField(node.entity, node.field);

    case "unary_minus": {
      const val = evaluate(node.operand, context);
      return val !== null ? -val : null;
    }

    case "binary_op": {
      const left = evaluate(node.left, context);
      const right = evaluate(node.right, context);

      // Null propagation: any null operand → null result
      if (left === null || right === null) return null;

      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          // Division by zero → null (not error)
          return right === 0 ? null : left / right;
      }
    }
  }
}

/**
 * Extract all field references from a formula string.
 * Used for dependency resolution (topological sort).
 */
export function extractFieldRefs(formula: string): { direct: string[]; crossEntity: { entity: string; field: string }[] } {
  const ast = parse(formula);
  const direct: string[] = [];
  const crossEntity: { entity: string; field: string }[] = [];

  function walk(node: ASTNode): void {
    switch (node.kind) {
      case "field_ref":
        direct.push(node.name);
        break;
      case "cross_entity_ref":
        crossEntity.push({ entity: node.entity, field: node.field });
        break;
      case "binary_op":
        walk(node.left);
        walk(node.right);
        break;
      case "unary_minus":
        walk(node.operand);
        break;
      case "number":
        break;
    }
  }

  walk(ast);
  return { direct, crossEntity };
}
