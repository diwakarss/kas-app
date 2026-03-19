/**
 * Template Engine for KAS App JSON Renderer
 *
 * Resolves placeholders in template strings using data and related entity data.
 * Handles separator collapse so that null/missing values produce clean output
 * without dangling separators or empty parentheses.
 *
 * Placeholder syntax:
 *   {field}         - resolves from data[field]
 *   {entity.field}  - resolves from relatedData[entity][field]
 *
 * Separator collapse rules:
 *   " - " with empty side  -> removed
 *   "()" empty parentheses -> removed
 *   Multiple spaces        -> single space
 *   Leading/trailing space -> trimmed
 */

const PLACEHOLDER_REGEX = /\{([a-zA-Z_][a-zA-Z0-9_.]*)\}/g;

/**
 * Resolve a single placeholder token to its value string.
 *
 * Returns the resolved string, or null if the value is
 * null, undefined, or empty string (indicating "no value").
 * Note: 0 is a valid value and returns "0".
 */
function resolvePlaceholder(
  token: string,
  data: Record<string, any>,
  relatedData?: Record<string, Record<string, any>>
): string | null {
  let value: any;

  if (token.includes('.')) {
    const [entity, ...fieldParts] = token.split('.');
    const field = fieldParts.join('.');
    value = relatedData?.[entity]?.[field];
  } else {
    value = data[token];
  }

  if (value === null || value === undefined) {
    return null;
  }

  const str = String(value);
  if (str === '') {
    return null;
  }

  return str;
}

/**
 * Collapse separators and clean up whitespace after placeholder substitution.
 *
 * Handles:
 *   - " - " where one or both sides are empty/whitespace
 *   - Empty parentheses "()" or "( )"
 *   - Multiple consecutive spaces -> single space
 *   - Leading/trailing whitespace
 */
function collapseSeparators(text: string): string {
  let result = text;

  // Remove " - " at start of string (left side was null)
  result = result.replace(/^\s*-\s+/, '');

  // Remove " - " at end of string (right side was null)
  result = result.replace(/\s+-\s*$/, '');

  // Collapse consecutive separators where middle was null: "A -  - C" -> "A - C"
  result = result.replace(/\s+-\s+-\s+/g, ' - ');

  // Remove empty parentheses
  result = result.replace(/\(\s*\)/g, '');

  // Collapse multiple spaces
  result = result.replace(/\s{2,}/g, ' ');

  return result.trim();
}

/**
 * Resolve a template string by substituting placeholders with data values.
 *
 * @param template    - Template string with {field} or {entity.field} placeholders
 * @param data        - Primary data record for simple {field} lookups
 * @param relatedData - Optional map of entity name -> record for {entity.field} lookups
 * @returns The resolved string with separators collapsed and whitespace cleaned
 */
export function resolveTemplate(
  template: string,
  data: Record<string, any>,
  relatedData?: Record<string, Record<string, any>>
): string {
  const substituted = template.replace(
    PLACEHOLDER_REGEX,
    (_match, token: string) => {
      const resolved = resolvePlaceholder(token, data, relatedData);
      return resolved !== null ? resolved : '';
    }
  );

  return collapseSeparators(substituted);
}
