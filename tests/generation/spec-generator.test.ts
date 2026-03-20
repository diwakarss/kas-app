/**
 * Spec Generator Integration Tests
 */

import { SpecGenerator } from '../../src/generation/services/spec-generator';

describe('SpecGenerator', () => {
  let generator: SpecGenerator;

  beforeEach(() => {
    generator = new SpecGenerator({
      allowFreshGeneration: false, // Disable LLM for unit tests
    });
  });

  describe('template-based generation', () => {
    it('generates spec from tutor template', async () => {
      const result = await generator.generate({
        business_type: 'tutor',
        business_name: "Ravi's Piano Academy",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.source).toBe('template');
        expect(result.template_used).toBe('tutor');
        expect(result.spec.meta.name).toBe("Ravi's Piano Academy");
      }
    });

    it('generates spec from keyword match', async () => {
      const result = await generator.generate({
        business_type: 'piano teacher',
        business_name: 'Music Academy',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.source).toBe('template');
        expect(result.template_used).toBe('tutor');
      }
    });

    it('generates spec from doctor template', async () => {
      const result = await generator.generate({
        business_type: 'clinic',
        business_name: "Dr. Sharma's Clinic",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.source).toBe('template');
        expect(result.template_used).toBe('doctor');
        expect(result.spec.entities.map((e) => e.name)).toContain('Patient');
      }
    });

    it('generates spec from shopkeeper template', async () => {
      const result = await generator.generate({
        business_type: 'retail store',
        business_name: "Kumar's Shop",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.source).toBe('template');
        expect(result.template_used).toBe('shopkeeper');
      }
    });
  });

  describe('validation', () => {
    it('rejects empty business_type', async () => {
      const result = await generator.generate({
        business_type: '',
        business_name: 'Test',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('business_type is required');
      }
    });

    it('rejects empty business_name', async () => {
      const result = await generator.generate({
        business_type: 'tutor',
        business_name: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('business_name is required');
      }
    });

    it('rejects whitespace-only inputs', async () => {
      const result = await generator.generate({
        business_type: '   ',
        business_name: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('no match handling', () => {
    it('returns error when no template matches and LLM disabled', async () => {
      const result = await generator.generate({
        business_type: 'blockchain consultant',
        business_name: 'Web3 Advisors',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error_type).toBe('generation');
        expect(result.errors.some((e) => e.includes('No template found'))).toBe(true);
      }
    });
  });

  describe('listTemplates', () => {
    it('returns all available templates', () => {
      const templates = generator.listTemplates();

      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.map((t) => t.id)).toContain('tutor');
      expect(templates.map((t) => t.id)).toContain('shopkeeper');
      expect(templates.map((t) => t.id)).toContain('doctor');
    });
  });

  describe('getTemplate', () => {
    it('returns specific template', () => {
      const template = generator.getTemplate('tutor');

      expect(template).not.toBeNull();
      expect(template!.meta.business_type).toBe('tutor');
    });

    it('returns null for unknown template', () => {
      const template = generator.getTemplate('nonexistent');
      expect(template).toBeNull();
    });
  });

  describe('fresh generation availability', () => {
    it('reports false when no LLM configured', async () => {
      const available = await generator.isFreshGenerationAvailable();
      expect(available).toBe(false);
    });
  });
});
