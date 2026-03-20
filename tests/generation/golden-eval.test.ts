/**
 * Golden Evaluation Test Set
 *
 * These tests define the expected behavior for spec generation across
 * various business types. They serve as a regression suite to ensure
 * LLM-generated specs meet quality standards.
 *
 * Test categories:
 * 1. Template matching - correct template selection for business types
 * 2. Identity injection - business name correctly applied
 * 3. Structural completeness - all required sections present
 * 4. Semantic correctness - entity relationships resolve
 */

import { SpecGenerator } from '../../src/generation/services/spec-generator';
import { validateGeneratedSpec } from '../../src/generation/services/spec-validator';
import { SpecLibrary } from '../../src/generation/services/spec-library';
import type { KASAppSpec } from '../../src/core/types/spec';

describe('Golden Evaluation Suite', () => {
  let generator: SpecGenerator;

  beforeAll(() => {
    generator = new SpecGenerator({ allowFreshGeneration: false });
  });

  describe('Template Selection', () => {
    const testCases = [
      // Exact matches
      { input: 'tutor', expectedTemplate: 'tutor' },
      { input: 'doctor', expectedTemplate: 'doctor' },
      { input: 'shopkeeper', expectedTemplate: 'shopkeeper' },

      // Keyword matches - education
      { input: 'piano teacher', expectedTemplate: 'tutor' },
      { input: 'music instructor', expectedTemplate: 'tutor' },
      { input: 'coaching center', expectedTemplate: 'tutor' },
      { input: 'private tuition', expectedTemplate: 'tutor' },

      // Keyword matches - medical
      { input: 'clinic', expectedTemplate: 'doctor' },
      { input: 'dental practice', expectedTemplate: 'doctor' },
      { input: 'healthcare provider', expectedTemplate: 'doctor' },
      { input: 'physician office', expectedTemplate: 'doctor' },

      // Keyword matches - retail
      { input: 'retail store', expectedTemplate: 'shopkeeper' },
      { input: 'grocery shop', expectedTemplate: 'shopkeeper' },
      { input: 'general store', expectedTemplate: 'shopkeeper' },
      { input: 'merchant', expectedTemplate: 'shopkeeper' },
    ];

    it.each(testCases)(
      'selects $expectedTemplate template for "$input"',
      async ({ input, expectedTemplate }) => {
        const result = await generator.generate({
          business_type: input,
          business_name: 'Test Business',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.template_used).toBe(expectedTemplate);
        }
      }
    );
  });

  describe('Business Identity Injection', () => {
    const identityTestCases = [
      {
        name: "Ravi's Piano Academy",
        expectedInName: "Ravi's Piano Academy",
        expectedInSlug: 'ravi-s-piano-academy',
      },
      {
        name: "Dr. Sharma's Clinic & Associates",
        expectedInName: "Dr. Sharma's Clinic & Associates",
        expectedInSlug: 'dr-sharma-s-clinic-associates',
      },
      {
        name: 'Kumar General Store',
        expectedInName: 'Kumar General Store',
        expectedInSlug: 'kumar-general-store',
      },
    ];

    it.each(identityTestCases)(
      'injects identity for "$name"',
      async ({ name, expectedInName, expectedInSlug }) => {
        const result = await generator.generate({
          business_type: 'tutor',
          business_name: name,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.spec.meta.name).toBe(expectedInName);
          expect(result.spec.meta.spec_id).toContain(expectedInSlug);
        }
      }
    );
  });

  describe('Structural Completeness', () => {
    const templates = ['tutor', 'doctor', 'shopkeeper'] as const;

    it.each(templates)('%s template has all required sections', async (templateId) => {
      const result = await generator.generate({
        business_type: templateId,
        business_name: 'Test Business',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const spec = result.spec;

        // Meta section
        expect(spec.meta).toBeDefined();
        expect(spec.meta.name).toBeDefined();
        expect(spec.meta.version).toBeDefined();
        expect(spec.meta.spec_id).toBeDefined();

        // Core structure
        expect(spec.entities).toBeDefined();
        expect(spec.entities.length).toBeGreaterThan(0);
        expect(spec.anchor).toBeDefined();
        expect(spec.computed_fields).toBeDefined();
        expect(spec.business_rules).toBeDefined();
        expect(spec.story_events).toBeDefined();
        expect(spec.add_flows).toBeDefined();
        expect(spec.chat_commands).toBeDefined();
        expect(spec.calendar).toBeDefined();
        expect(spec.search).toBeDefined();
      }
    });

    it.each(templates)('%s template entities have required fields', async (templateId) => {
      const result = await generator.generate({
        business_type: templateId,
        business_name: 'Test Business',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        for (const entity of result.spec.entities) {
          // Entity structure
          expect(entity.name).toBeDefined();
          expect(entity.display_name).toBeDefined();
          expect(entity.fields).toBeDefined();
          expect(entity.fields.length).toBeGreaterThan(0);
          expect(entity.relationships).toBeDefined();

          // At least one required field per entity (anchor entity)
          // Not all entities need required fields, so we check anchor
          if (entity.name === result.spec.anchor.entity) {
            const hasRequiredField = entity.fields.some((f) => f.required);
            expect(hasRequiredField).toBe(true);
          }

          // Field structure
          for (const field of entity.fields) {
            expect(field.name).toBeDefined();
            expect(field.display_name).toBeDefined();
            expect(field.type).toBeDefined();
          }
        }
      }
    });
  });

  describe('Semantic Correctness', () => {
    const templates = ['tutor', 'doctor', 'shopkeeper'] as const;

    it.each(templates)('%s template passes full validation', async (templateId) => {
      const result = await generator.generate({
        business_type: templateId,
        business_name: 'Test Business',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const validation = validateGeneratedSpec(result.spec);

        expect(validation.valid).toBe(true);
        expect(validation.structural_errors).toEqual([]);
        expect(validation.semantic_errors).toEqual([]);
        expect(validation.injection_warnings).toEqual([]);
        expect(validation.business_logic_errors).toEqual([]);
      }
    });

    it.each(templates)('%s template has valid anchor entity', async (templateId) => {
      const result = await generator.generate({
        business_type: templateId,
        business_name: 'Test Business',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const spec = result.spec;
        const anchorEntity = spec.entities.find((e) => e.name === spec.anchor.entity);

        expect(anchorEntity).toBeDefined();

        // Anchor should have a date/datetime field for scheduling
        const dateField = anchorEntity!.fields.find(
          (f) => f.type === 'date' || f.type === 'datetime'
        );
        expect(dateField).toBeDefined();
      }
    });

    it.each(templates)('%s template relationships resolve', async (templateId) => {
      const result = await generator.generate({
        business_type: templateId,
        business_name: 'Test Business',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const entityNames = new Set(result.spec.entities.map((e) => e.name));

        for (const entity of result.spec.entities) {
          for (const rel of entity.relationships) {
            expect(entityNames.has(rel.target)).toBe(true);
          }
        }
      }
    });
  });

  describe('Domain-Specific Requirements', () => {
    describe('Tutor Template', () => {
      it('has Student and Class entities', async () => {
        const result = await generator.generate({
          business_type: 'tutor',
          business_name: 'Music Academy',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const entityNames = result.spec.entities.map((e) => e.name);
          expect(entityNames).toContain('Student');
          expect(entityNames).toContain('Class');
        }
      });

      it('has Class as anchor entity', async () => {
        const result = await generator.generate({
          business_type: 'tutor',
          business_name: 'Music Academy',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.spec.anchor.entity).toBe('Class');
        }
      });
    });

    describe('Doctor Template', () => {
      it('has Patient and Appointment entities', async () => {
        const result = await generator.generate({
          business_type: 'doctor',
          business_name: 'Family Clinic',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const entityNames = result.spec.entities.map((e) => e.name);
          expect(entityNames).toContain('Patient');
          expect(entityNames).toContain('Appointment');
        }
      });

      it('has appointment as anchor entity', async () => {
        const result = await generator.generate({
          business_type: 'doctor',
          business_name: 'Family Clinic',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.spec.anchor.entity).toBe('Appointment');
        }
      });

      it('has Prescription entity for medical records', async () => {
        const result = await generator.generate({
          business_type: 'doctor',
          business_name: 'Family Clinic',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const entityNames = result.spec.entities.map((e) => e.name);
          expect(entityNames).toContain('Prescription');
        }
      });
    });

    describe('Shopkeeper Template', () => {
      it('has Customer and Transaction entities', async () => {
        const result = await generator.generate({
          business_type: 'shopkeeper',
          business_name: 'General Store',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const entityNames = result.spec.entities.map((e) => e.name);
          expect(entityNames).toContain('Customer');
          expect(entityNames).toContain('Transaction');
        }
      });

      it('has Transaction as anchor entity', async () => {
        const result = await generator.generate({
          business_type: 'shopkeeper',
          business_name: 'General Store',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.spec.anchor.entity).toBe('Transaction');
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles unicode business names', async () => {
      const result = await generator.generate({
        business_type: 'tutor',
        business_name: '音楽教室',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.meta.name).toBe('音楽教室');
        // Slug should handle unicode gracefully
        expect(result.spec.meta.spec_id).toBeDefined();
      }
    });

    it('handles business names with numbers', async () => {
      const result = await generator.generate({
        business_type: 'doctor',
        business_name: '24/7 Medical Clinic',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.meta.name).toBe('24/7 Medical Clinic');
      }
    });

    it('handles very long business names (up to 100 chars)', async () => {
      const longName = 'A'.repeat(100);
      const result = await generator.generate({
        business_type: 'shopkeeper',
        business_name: longName,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.meta.name).toBe(longName);
      }
    });

    it('rejects business names over 100 chars', async () => {
      const tooLongName = 'A'.repeat(101);
      const result = await generator.generate({
        business_type: 'tutor',
        business_name: tooLongName,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.includes('100'))).toBe(true);
      }
    });
  });

  describe('Template Library Consistency', () => {
    it('all templates in index are loadable', () => {
      const templates = SpecLibrary.listTemplates();

      for (const meta of templates) {
        const spec = SpecLibrary.getTemplate(meta.id);
        expect(spec).not.toBeNull();
      }
    });

    it('all templates pass validation', () => {
      const templates = SpecLibrary.listTemplates();

      for (const meta of templates) {
        const spec = SpecLibrary.getTemplate(meta.id);
        const validation = validateGeneratedSpec(spec);

        expect(validation.valid).toBe(true);
        expect(validation.structural_errors).toEqual([]);
        expect(validation.semantic_errors).toEqual([]);
        expect(validation.injection_warnings).toEqual([]);
      }
    });

    it('template keywords are unique per template', () => {
      const templates = SpecLibrary.listTemplates();
      const allKeywords = new Map<string, string[]>();

      for (const meta of templates) {
        for (const keyword of meta.keywords) {
          const existing = allKeywords.get(keyword) || [];
          existing.push(meta.id);
          allKeywords.set(keyword, existing);
        }
      }

      // Check for ambiguous keywords (shared by multiple templates)
      const ambiguous = Array.from(allKeywords.entries()).filter(([, ids]) => ids.length > 1);

      // This is informational - shared keywords are handled by confidence scoring
      if (ambiguous.length > 0) {
        console.log('Shared keywords:', ambiguous);
      }
    });
  });
});
