/**
 * v1 → v2 Spec Migration Tests
 *
 * Verifies that all template specs convert correctly between formats
 * without data loss. Both directions are tested (v1→v2 and v2→v1).
 */

import { SpecLibrary } from '../../src/generation/services/spec-library';
import {
  convertV1toV2,
  convertV2toV1,
  detectSpecVersion,
  ensureV2,
  SPEC_FORMAT_VERSION,
} from '../../src/core/types/kas-spec-v2';
import type { KASAppSpec } from '../../src/core/types/spec';

// ── Helpers ───────────────────────────────────────────────

function getTemplateSpec(id: string): KASAppSpec {
  const spec = SpecLibrary.getTemplate(id);
  if (!spec) throw new Error(`Template ${id} not found`);
  return spec;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ── Tests ─────────────────────────────────────────────────

describe('v2 Spec Migration', () => {
  const templates = SpecLibrary.listTemplates().map((t) => t.id);

  describe('convertV1toV2', () => {
    it.each(templates)('%s template converts to v2 without data loss', (templateId) => {
      const v1 = getTemplateSpec(templateId);
      const v2 = convertV1toV2(v1);

      // Business layer preserved
      expect(v2.meta.name).toBe(v1.meta.name);
      expect(v2.meta.spec_id).toBe(v1.meta.spec_id);
      expect(v2.entities).toEqual(v1.entities);
      expect(v2.computed_fields).toEqual(v1.computed_fields);
      expect(v2.business_rules).toEqual(v1.business_rules);
      expect(v2.chat_commands).toEqual(v1.chat_commands);

      // UI fields moved into ui_hints
      expect(v2.ui_hints.anchor).toEqual(v1.anchor);
      expect(v2.ui_hints.story_events).toEqual(v1.story_events);
      expect(v2.ui_hints.add_flows).toEqual(v1.add_flows);
      expect(v2.ui_hints.search).toEqual(v1.search);
      expect(v2.ui_hints.calendar).toEqual(v1.calendar);

      // Version marker set
      expect(v2.meta.spec_version).toBe(SPEC_FORMAT_VERSION);
    });

    it.each(templates)('%s v2 does NOT have top-level anchor/story_events/etc', (templateId) => {
      const v1 = getTemplateSpec(templateId);
      const v2 = convertV1toV2(v1) as any;

      expect(v2.anchor).toBeUndefined();
      expect(v2.story_events).toBeUndefined();
      expect(v2.add_flows).toBeUndefined();
      expect(v2.search).toBeUndefined();
      expect(v2.calendar).toBeUndefined();
    });
  });

  describe('convertV2toV1 (rollback)', () => {
    it.each(templates)('%s round-trips v1→v2→v1 without data loss', (templateId) => {
      const original = getTemplateSpec(templateId);
      const v2 = convertV1toV2(original);
      const roundTripped = convertV2toV1(v2);

      // Round-trip should produce identical data (except spec_version added by conversion)
      expect(roundTripped.entities).toEqual(original.entities);
      expect(roundTripped.anchor).toEqual(original.anchor);
      expect(roundTripped.story_events).toEqual(original.story_events);
      expect(roundTripped.add_flows).toEqual(original.add_flows);
      expect(roundTripped.search).toEqual(original.search);
      expect(roundTripped.calendar).toEqual(original.calendar);
      expect(roundTripped.computed_fields).toEqual(original.computed_fields);
      expect(roundTripped.business_rules).toEqual(original.business_rules);
      expect(roundTripped.chat_commands).toEqual(original.chat_commands);
    });
  });

  describe('detectSpecVersion', () => {
    it('detects v1 spec (has anchor at top level)', () => {
      const v1 = getTemplateSpec('tutor');
      expect(detectSpecVersion(v1)).toBe(1);
    });

    it('detects v2 spec (has ui_hints)', () => {
      const v1 = getTemplateSpec('tutor');
      const v2 = convertV1toV2(v1);
      expect(detectSpecVersion(v2)).toBe(2);
    });

    it('returns 1 for null/undefined', () => {
      expect(detectSpecVersion(null)).toBe(1);
      expect(detectSpecVersion(undefined)).toBe(1);
    });

    it('returns 1 for empty object', () => {
      expect(detectSpecVersion({})).toBe(1);
    });
  });

  describe('ensureV2', () => {
    it('passes through v2 specs unchanged', () => {
      const v1 = getTemplateSpec('tutor');
      const v2 = convertV1toV2(v1);
      const result = ensureV2(v2);
      expect(result).toBe(v2); // Same reference
    });

    it('converts v1 specs to v2', () => {
      const v1 = getTemplateSpec('tutor');
      const result = ensureV2(v1);
      expect(result.ui_hints).toBeDefined();
      expect(result.ui_hints.anchor).toEqual(v1.anchor);
    });
  });

  describe('entity preservation', () => {
    it('tutor template preserves all 4 entities', () => {
      const v1 = getTemplateSpec('tutor');
      const v2 = convertV1toV2(v1);
      const entityNames = v2.entities.map((e) => e.name);
      expect(entityNames).toContain('Student');
      expect(entityNames).toContain('Class');
      expect(entityNames).toContain('Payment');
      expect(entityNames).toContain('Note');
      expect(v2.entities.length).toBe(4);
    });

    it('preserves all fields and relationships', () => {
      const v1 = getTemplateSpec('tutor');
      const v2 = convertV1toV2(v1);

      for (let i = 0; i < v1.entities.length; i++) {
        expect(v2.entities[i].fields).toEqual(v1.entities[i].fields);
        expect(v2.entities[i].relationships).toEqual(v1.entities[i].relationships);
      }
    });

    it('preserves computed fields with formulas', () => {
      const v1 = getTemplateSpec('tutor');
      const v2 = convertV1toV2(v1);

      // Tutor has computed fields on Student and Class
      expect(v2.computed_fields['Student']).toBeDefined();
      expect(v2.computed_fields['Student'].length).toBeGreaterThan(0);

      // Check formula field preserved
      const dueAmount = v2.computed_fields['Student'].find((f) => f.name === 'due_amount');
      expect(dueAmount).toBeDefined();
      expect(dueAmount!.type).toBe('formula');
      expect(dueAmount!.formula).toBe('total_earned - total_paid');
    });
  });
});
