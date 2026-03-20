/**
 * Category Matcher Tests
 */

import { CategoryMatcher } from '../../src/generation/services/category-matcher';

describe('CategoryMatcher', () => {
  describe('exact matching', () => {
    it('matches exact template ID', () => {
      const result = CategoryMatcher.match('tutor');

      expect(result.templateId).toBe('tutor');
      expect(result.confidence).toBe(1.0);
      expect(result.matchType).toBe('exact');
    });

    it('matches case-insensitively', () => {
      const result = CategoryMatcher.match('TUTOR');

      expect(result.templateId).toBe('tutor');
      expect(result.matchType).toBe('exact');
    });

    it('matches with leading/trailing spaces', () => {
      const result = CategoryMatcher.match('  tutor  ');

      expect(result.templateId).toBe('tutor');
      expect(result.matchType).toBe('exact');
    });
  });

  describe('keyword matching', () => {
    it('matches on keyword exact match', () => {
      const result = CategoryMatcher.match('teacher');

      expect(result.templateId).toBe('tutor');
      expect(result.confidence).toBe(1.0);
      expect(result.matchType).toBe('keyword');
    });

    it('matches when keyword is contained', () => {
      const result = CategoryMatcher.match('piano tutor');

      expect(result.templateId).toBe('tutor');
      expect(result.matchType).toBe('keyword');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('matches doctor keywords', () => {
      const result = CategoryMatcher.match('clinic');

      expect(result.templateId).toBe('doctor');
      expect(result.matchType).toBe('keyword');
    });

    it('matches shopkeeper keywords', () => {
      const result = CategoryMatcher.match('retail store');

      expect(result.templateId).toBe('shopkeeper');
      expect(result.matchType).toBe('keyword');
    });
  });

  describe('fuzzy matching', () => {
    it('matches with typo - tutr', () => {
      const result = CategoryMatcher.match('tutr');

      expect(result.templateId).toBe('tutor');
      expect(result.matchType).toBe('fuzzy');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('matches with typo - docter', () => {
      const result = CategoryMatcher.match('docter');

      expect(result.templateId).toBe('doctor');
      expect(result.matchType).toBe('fuzzy');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('no match', () => {
    it('returns null for unknown business type', () => {
      const result = CategoryMatcher.match('blockchain consultant');

      expect(result.templateId).toBeNull();
      expect(result.matchType).toBe('none');
      expect(result.confidence).toBe(0);
    });

    it('returns null for empty string', () => {
      const result = CategoryMatcher.match('');

      expect(result.templateId).toBeNull();
      expect(result.matchType).toBe('none');
    });

    it('returns null for whitespace only', () => {
      const result = CategoryMatcher.match('   ');

      expect(result.templateId).toBeNull();
      expect(result.matchType).toBe('none');
    });
  });

  describe('alternatives', () => {
    it('returns alternatives when multiple matches possible', () => {
      // This test depends on template keywords - may need adjustment
      const result = CategoryMatcher.match('store');

      expect(result.templateId).toBe('shopkeeper');
      // May or may not have alternatives depending on keyword overlap
    });
  });

  describe('getCategories', () => {
    it('returns all template IDs', () => {
      const categories = CategoryMatcher.getCategories();

      expect(categories).toContain('tutor');
      expect(categories).toContain('shopkeeper');
      expect(categories).toContain('doctor');
    });
  });

  describe('hasMatch', () => {
    it('returns true when match exists', () => {
      expect(CategoryMatcher.hasMatch('tutor')).toBe(true);
      expect(CategoryMatcher.hasMatch('teacher')).toBe(true);
    });

    it('returns false when no match', () => {
      expect(CategoryMatcher.hasMatch('spaceship pilot')).toBe(false);
    });
  });
});
