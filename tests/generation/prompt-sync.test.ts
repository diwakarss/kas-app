/**
 * Prompt Sync Test
 *
 * Verifies that catalog.prompt() + KAS business rules produce a system
 * prompt containing everything the LLM needs to generate valid specs.
 * This is the go/no-go gate for the json-render prompt migration.
 */

import { buildSystemPrompt } from '../../src/generation/services/llm-adaptation';
import { catalog, kasComponentNames, kasActionNames } from '../../src/ui/catalog';

describe('Prompt Sync', () => {
  const prompt = buildSystemPrompt();

  // ── Component coverage ──────────────────────────────────

  test('prompt includes all 14 KAS component names', () => {
    for (const name of kasComponentNames) {
      expect(prompt).toContain(name);
    }
  });

  test('prompt includes all 4 KAS action names', () => {
    for (const name of kasActionNames) {
      expect(prompt).toContain(name);
    }
  });

  // ── Field type coverage ──────────────────────────────────

  test('prompt includes all 13 field types', () => {
    const fieldTypes = [
      'text', 'number', 'currency', 'phone', 'email',
      'choice', 'date', 'datetime', 'time', 'toggle',
      'duration', 'note', 'image',
    ];
    for (const ft of fieldTypes) {
      expect(prompt).toContain(ft);
    }
  });

  // ── Business schema coverage ────────────────────────────

  test('prompt includes entity structure instructions', () => {
    expect(prompt).toContain('entities');
    expect(prompt).toContain('fields');
    expect(prompt).toContain('relationships');
    expect(prompt).toContain('belongs_to');
  });

  test('prompt includes anchor instructions', () => {
    expect(prompt).toContain('anchor');
    expect(prompt).toContain('day_schedule');
    expect(prompt).toContain('greeting_template');
    expect(prompt).toContain('card_display');
    expect(prompt).toContain('empty_state');
  });

  test('prompt includes story_events instructions', () => {
    expect(prompt).toContain('story_events');
    expect(prompt).toContain('stats_card');
    expect(prompt).toContain('coming_up');
  });

  test('prompt includes add_flows instructions', () => {
    expect(prompt).toContain('add_flows');
    expect(prompt).toContain('steps');
  });

  test('prompt includes search and calendar instructions', () => {
    expect(prompt).toContain('search');
    expect(prompt).toContain('calendar');
    expect(prompt).toContain('date_field');
  });

  test('prompt includes computed_fields instructions', () => {
    expect(prompt).toContain('computed_fields');
    expect(prompt).toContain('count');
    expect(prompt).toContain('sum');
    expect(prompt).toContain('days_since');
    expect(prompt).toContain('formula');
  });

  test('prompt includes business_rules instructions', () => {
    expect(prompt).toContain('business_rules');
  });

  // ── Critical rules ──────────────────────────────────────

  test('prompt includes critical rules about FK naming', () => {
    expect(prompt).toContain('_id');
  });

  test('prompt includes rule about searchable name field', () => {
    expect(prompt).toContain('searchable');
  });

  test('prompt includes /no_think prefix', () => {
    expect(prompt.startsWith('/no_think')).toBe(true);
  });

  // ── Custom rules passthrough ────────────────────────────

  test('custom rules are included in the prompt', () => {
    const custom = buildSystemPrompt(['Include a loyalty points system']);
    expect(custom).toContain('Include a loyalty points system');
  });

  // ── Prompt size ─────────────────────────────────────────

  test('prompt is under 30000 characters', () => {
    // Full prompt: 25+ standard components + 14 KAS components + 4 actions + business rules
    // ~27k chars (~6700 tokens). If this grows past 30k, investigate compression.
    expect(prompt.length).toBeLessThan(30000);
  });

  test('prompt is at least 2000 characters (not empty/truncated)', () => {
    expect(prompt.length).toBeGreaterThan(2000);
  });

  // ── Catalog-prompt consistency ──────────────────────────

  test('catalog.prompt() output is embedded in the system prompt', () => {
    const catalogOnly = catalog.prompt({ mode: 'standalone' });
    // The system prompt wraps catalog.prompt() with /no_think and KAS rules
    expect(prompt).toContain(catalogOnly.slice(0, 100));
  });
});
