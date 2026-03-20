/**
 * Business Identity Service Tests
 */

import {
  validateIdentity,
  injectIdentity,
  extractIdentity,
} from '../../src/generation/services/business-identity';
import { SpecLibrary } from '../../src/generation/services/spec-library';

describe('BusinessIdentityService', () => {
  describe('validateIdentity', () => {
    it('validates valid identity', () => {
      const result = validateIdentity({
        name: 'Ravi Piano Academy',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects empty name', () => {
      const result = validateIdentity({
        name: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('business_name is required and cannot be empty');
    });

    it('rejects whitespace-only name', () => {
      const result = validateIdentity({
        name: '   ',
      });

      expect(result.valid).toBe(false);
    });

    it('rejects name exceeding 100 characters', () => {
      const result = validateIdentity({
        name: 'A'.repeat(101),
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('business_name cannot exceed 100 characters');
    });

    it('validates hex colors correctly', () => {
      const validResult = validateIdentity({
        name: 'Test',
        primary_color: '#FF5733',
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateIdentity({
        name: 'Test',
        primary_color: 'red',
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.some((e) => e.includes('primary_color'))).toBe(true);
    });

    it('allows undefined optional fields', () => {
      const result = validateIdentity({
        name: 'Test Business',
        icon: undefined,
        primary_color: undefined,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('injectIdentity', () => {
    let tutorSpec: any;

    beforeAll(() => {
      tutorSpec = SpecLibrary.getTemplate('tutor');
    });

    it('injects business name into spec.meta.name', () => {
      const result = injectIdentity(tutorSpec, {
        name: "Ravi's Piano Academy",
      });

      expect(result.meta.name).toBe("Ravi's Piano Academy");
    });

    it('generates new spec_id with business name slug', () => {
      const result = injectIdentity(tutorSpec, {
        name: "Ravi's Piano Academy",
      });

      // Slug generation sanitizes apostrophes
      expect(result.meta.spec_id).toContain('ravi-s-piano-academy');
      expect(result.meta.spec_id).toContain('tutor');
    });

    it('updates created_date to current time', () => {
      const before = new Date();
      const result = injectIdentity(tutorSpec, { name: 'Test' });
      const after = new Date();

      const createdDate = new Date(result.meta.created_date);
      expect(createdDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createdDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('clears customizations array', () => {
      const result = injectIdentity(tutorSpec, { name: 'Test' });
      expect(result.meta.customizations).toEqual([]);
    });

    it('does not mutate original spec', () => {
      const originalName = tutorSpec.meta.name;
      injectIdentity(tutorSpec, { name: 'New Name' });

      expect(tutorSpec.meta.name).toBe(originalName);
    });

    it('throws on invalid identity', () => {
      expect(() => {
        injectIdentity(tutorSpec, { name: '' });
      }).toThrow('Invalid business identity');
    });

    it('handles special characters in name', () => {
      const result = injectIdentity(tutorSpec, {
        name: "Dr. Smith's Clinic & Associates",
      });

      expect(result.meta.name).toBe("Dr. Smith's Clinic & Associates");
      // Slug should be sanitized
      expect(result.meta.spec_id).not.toContain("'");
      expect(result.meta.spec_id).not.toContain('&');
    });
  });

  describe('extractIdentity', () => {
    it('extracts name from spec', () => {
      const spec = SpecLibrary.getTemplate('tutor')!;
      const identity = extractIdentity(spec);

      expect(identity.name).toBe(spec.meta.name);
    });
  });
});
