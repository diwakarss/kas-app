/**
 * Extended Spec Validator Tests
 */

import {
  validateGeneratedSpec,
  getAllErrors,
} from '../../src/generation/services/spec-validator';
import { SpecLibrary } from '../../src/generation/services/spec-library';

describe('SpecValidator', () => {
  describe('structural validation', () => {
    it('validates existing templates successfully', () => {
      const tutorSpec = SpecLibrary.getTemplate('tutor');
      const result = validateGeneratedSpec(tutorSpec);

      expect(result.valid).toBe(true);
      expect(result.structural_errors).toEqual([]);
    });

    it('rejects non-object input', () => {
      const result = validateGeneratedSpec('not an object');

      expect(result.valid).toBe(false);
      expect(result.structural_errors.length).toBeGreaterThan(0);
    });

    it('rejects spec missing required sections', () => {
      const result = validateGeneratedSpec({
        meta: { name: 'Test', version: 1, spec_id: 'test' },
        // Missing entities, anchor, etc.
      });

      expect(result.valid).toBe(false);
      expect(result.structural_errors.some((e) => e.includes('entities'))).toBe(true);
    });
  });

  describe('semantic validation', () => {
    it('detects invalid relationship targets', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      // Add invalid relationship
      spec.entities[0].relationships.push({
        target: 'NonExistentEntity',
        type: 'has_many',
        foreign_key: 'entity_id',
        display_in_story: false,
      });

      const result = validateGeneratedSpec(spec);

      expect(result.valid).toBe(false);
      // spec-loader's structural validation catches relationship target issues
      expect(result.structural_errors.some((e) => e.includes('NonExistentEntity'))).toBe(true);
    });

    it('detects invalid computed field source_entity', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      // Add computed field referencing non-existent entity
      spec.computed_fields.Student.push({
        name: 'invalid_count',
        display_name: 'Invalid Count',
        type: 'count',
        source_entity: 'NonExistent',
        relationship: 'student_id',
      });

      const result = validateGeneratedSpec(spec);

      expect(result.valid).toBe(false);
      // spec-loader's structural validation catches computed field entity references
      expect(
        result.structural_errors.some(
          (e) => e.includes('source_entity') || e.includes('NonExistent')
        )
      ).toBe(true);
    });

    it('detects invalid business rule entity', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      // Add rule for non-existent entity
      spec.business_rules.push({
        id: 'invalid_rule',
        name: 'Invalid Rule',
        entity: 'NonExistent',
        condition: { type: 'field_empty', field: 'name' },
        warning: { message: 'Test', severity: 'info', show_in: [] },
      });

      const result = validateGeneratedSpec(spec);

      expect(result.valid).toBe(false);
      // spec-loader's structural validation catches business rule entity references
      expect(result.structural_errors.some((e) => e.includes('NonExistent'))).toBe(true);
    });
  });

  describe('injection detection', () => {
    it('detects SQL injection patterns', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      spec.meta.name = "Test'; DROP TABLE students; --";

      const result = validateGeneratedSpec(spec);

      // Injection warnings don't fail validation by default
      expect(result.injection_warnings.length).toBeGreaterThan(0);
      // Check for SQL-related patterns
      expect(result.injection_warnings.some((w) => w.includes('injection') || w.includes('DROP'))).toBe(true);
    });

    it('detects template injection patterns', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      spec.entities[0].fields[0].placeholder = '${process.env.SECRET}';

      const result = validateGeneratedSpec(spec);

      expect(result.injection_warnings.length).toBeGreaterThan(0);
    });

    it('valid specs have no injection warnings', () => {
      const spec = SpecLibrary.getTemplate('tutor');
      const result = validateGeneratedSpec(spec);

      expect(result.injection_warnings).toEqual([]);
    });
  });

  describe('business logic validation', () => {
    it('validates anchor entity exists', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      spec.anchor.entity = 'NonExistent';

      const result = validateGeneratedSpec(spec);

      expect(result.valid).toBe(false);
      // spec-loader's structural validation catches anchor entity references
      expect(
        result.structural_errors.some((e) => e.includes('anchor') || e.includes('NonExistent'))
      ).toBe(true);
    });

    it('validates calendar date field exists', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      spec.calendar.date_field = 'nonexistent_field';

      const result = validateGeneratedSpec(spec);

      expect(result.valid).toBe(false);
      expect(result.business_logic_errors.some((e) => e.includes('date_field'))).toBe(true);
    });

    it('validates search entities exist', () => {
      const spec = JSON.parse(JSON.stringify(SpecLibrary.getTemplate('tutor')));
      spec.search.entities.push('NonExistent');

      const result = validateGeneratedSpec(spec);

      expect(result.valid).toBe(false);
      expect(result.business_logic_errors.some((e) => e.includes('Search entity'))).toBe(true);
    });
  });

  describe('getAllErrors', () => {
    it('combines all error types into flat list', () => {
      const result = {
        valid: false,
        structural_errors: ['Structural error 1'],
        semantic_errors: ['Semantic error 1'],
        injection_warnings: ['Injection warning'],
        business_logic_errors: ['Logic error 1'],
      };

      const allErrors = getAllErrors(result);

      expect(allErrors).toContain('[Structure] Structural error 1');
      expect(allErrors).toContain('[Semantic] Semantic error 1');
      expect(allErrors).toContain('[Logic] Logic error 1');
      // Injection warnings are not included in errors by default
      expect(allErrors.some((e) => e.includes('Injection'))).toBe(false);
    });
  });
});
