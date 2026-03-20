/**
 * Spec Library Tests
 */

import { SpecLibrary } from '../../src/generation/services/spec-library';

describe('SpecLibrary', () => {
  beforeEach(() => {
    SpecLibrary.clearCache();
  });

  describe('listTemplates', () => {
    it('returns all templates from index', () => {
      const templates = SpecLibrary.listTemplates();

      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.map((t) => t.id)).toContain('tutor');
      expect(templates.map((t) => t.id)).toContain('shopkeeper');
      expect(templates.map((t) => t.id)).toContain('doctor');
    });

    it('each template has required metadata fields', () => {
      const templates = SpecLibrary.listTemplates();

      for (const template of templates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.keywords).toBeDefined();
        expect(Array.isArray(template.keywords)).toBe(true);
        expect(template.category).toBeDefined();
      }
    });
  });

  describe('getTemplate', () => {
    it('returns tutor template', () => {
      const spec = SpecLibrary.getTemplate('tutor');

      expect(spec).not.toBeNull();
      expect(spec!.meta.business_type).toBe('tutor');
      expect(spec!.entities.length).toBeGreaterThanOrEqual(3);
    });

    it('returns shopkeeper template', () => {
      const spec = SpecLibrary.getTemplate('shopkeeper');

      expect(spec).not.toBeNull();
      expect(spec!.meta.business_type).toBe('shopkeeper');
    });

    it('returns doctor template', () => {
      const spec = SpecLibrary.getTemplate('doctor');

      expect(spec).not.toBeNull();
      expect(spec!.meta.business_type).toBe('doctor');
      expect(spec!.entities.map((e) => e.name)).toContain('Patient');
      expect(spec!.entities.map((e) => e.name)).toContain('Appointment');
    });

    it('returns null for unknown template', () => {
      const spec = SpecLibrary.getTemplate('nonexistent');
      expect(spec).toBeNull();
    });

    it('caches loaded templates', () => {
      const spec1 = SpecLibrary.getTemplate('tutor');
      const spec2 = SpecLibrary.getTemplate('tutor');

      // Should be the exact same object reference
      expect(spec1).toBe(spec2);
    });
  });

  describe('getTemplateMetadata', () => {
    it('returns metadata for existing template', () => {
      const metadata = SpecLibrary.getTemplateMetadata('tutor');

      expect(metadata).not.toBeNull();
      expect(metadata!.id).toBe('tutor');
      expect(metadata!.keywords).toContain('tutor');
    });

    it('returns null for unknown template', () => {
      const metadata = SpecLibrary.getTemplateMetadata('nonexistent');
      expect(metadata).toBeNull();
    });
  });

  describe('hasTemplate', () => {
    it('returns true for existing templates', () => {
      expect(SpecLibrary.hasTemplate('tutor')).toBe(true);
      expect(SpecLibrary.hasTemplate('shopkeeper')).toBe(true);
      expect(SpecLibrary.hasTemplate('doctor')).toBe(true);
    });

    it('returns false for unknown templates', () => {
      expect(SpecLibrary.hasTemplate('nonexistent')).toBe(false);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('returns education templates', () => {
      const templates = SpecLibrary.getTemplatesByCategory('education');
      expect(templates.some((t) => t.id === 'tutor')).toBe(true);
    });

    it('returns healthcare templates', () => {
      const templates = SpecLibrary.getTemplatesByCategory('healthcare');
      expect(templates.some((t) => t.id === 'doctor')).toBe(true);
    });

    it('returns empty array for unknown category', () => {
      const templates = SpecLibrary.getTemplatesByCategory('unknown');
      expect(templates).toEqual([]);
    });
  });

  describe('searchTemplates', () => {
    it('finds templates by keyword', () => {
      const results = SpecLibrary.searchTemplates('patient');
      expect(results.some((t) => t.id === 'doctor')).toBe(true);
    });

    it('finds templates by name', () => {
      const results = SpecLibrary.searchTemplates('Private Tutor');
      expect(results.some((t) => t.id === 'tutor')).toBe(true);
    });

    it('returns empty array for no matches', () => {
      const results = SpecLibrary.searchTemplates('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('is case-insensitive', () => {
      const results1 = SpecLibrary.searchTemplates('TUTOR');
      const results2 = SpecLibrary.searchTemplates('tutor');

      expect(results1.length).toBe(results2.length);
    });
  });

  describe('getVersion', () => {
    it('returns registry version', () => {
      const version = SpecLibrary.getVersion();
      expect(version).toBeGreaterThanOrEqual(1);
    });
  });
});
