/**
 * Date/time formatting helpers used across the renderer surface.
 *
 * The runtime stores schedules as ISO 8601 strings ("2026-04-28T03:30:00.000Z").
 * Showing those raw on cards, stats, and footers reads like a bug to a real
 * business owner. These helpers convert them to local-friendly text.
 */

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SQL_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

// Substrings that appear inside larger templates ("Lesson: 2026-04-28T...").
const ISO_DATETIME_SUBSTRING_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const SQL_TIMESTAMP_SUBSTRING_RE = /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:\.\d+)?/g;
const ISO_DATE_SUBSTRING_RE = /(?<![\dT])\d{4}-\d{2}-\d{2}(?![\dT])/g;

/**
 * Format a single date/datetime value.
 * Pass `fieldType` to bias toward datetime vs date when the string is ambiguous.
 */
export function formatDateValue(value: unknown, fieldType?: string): string {
  if (value == null) return '';
  const str = String(value);

  if (fieldType === 'datetime' || ISO_DATETIME_RE.test(str) || SQL_TIMESTAMP_RE.test(str)) {
    const d = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  if (fieldType === 'date' || ISO_DATE_RE.test(str)) {
    const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return str;
}

/**
 * Find ISO/SQL timestamp substrings inside any free-form text and replace
 * them with human-readable versions. Used for resolved templates where a
 * date placeholder leaks through verbatim ("Lesson: 2026-04-28T03:30:00Z").
 */
export function humanizeDateStrings(text: string): string {
  if (!text) return text;
  return text
    .replace(ISO_DATETIME_SUBSTRING_RE, m => formatDateValue(m, 'datetime'))
    .replace(SQL_TIMESTAMP_SUBSTRING_RE, m => formatDateValue(m, 'datetime'))
    .replace(ISO_DATE_SUBSTRING_RE, m => formatDateValue(m, 'date'));
}
