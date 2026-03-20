/**
 * Category Matcher Service
 *
 * Maps business types to templates using:
 * 1. Exact match on template ID
 * 2. Keyword matching from template metadata
 * 3. Fuzzy matching for typos/variations
 *
 * Returns null if no match found (triggers LLM generation).
 */

import { SpecLibrary } from './spec-library';
import type { TemplateMetadata } from '../types/generation';

/**
 * Result of a category match.
 */
export interface MatchResult {
  /** Matched template ID, or null if no match */
  templateId: string | null;
  /** Match confidence (0.0 - 1.0) */
  confidence: number;
  /** How the match was made */
  matchType: 'exact' | 'keyword' | 'fuzzy' | 'none';
  /** Alternative matches if confidence < 1.0 */
  alternatives?: string[];
}

/**
 * Normalize a string for matching (lowercase, trim, remove special chars).
 */
function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0.0 - 1.0).
 */
function similarity(a: string, b: string): number {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0.0;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

/**
 * Check if a business type matches a template's keywords.
 */
function matchKeywords(
  businessType: string,
  template: TemplateMetadata
): { match: boolean; confidence: number } {
  const normalizedType = normalize(businessType);

  // Check exact keyword match
  for (const keyword of template.keywords) {
    if (normalize(keyword) === normalizedType) {
      return { match: true, confidence: 1.0 };
    }
  }

  // Check if business type contains a keyword
  for (const keyword of template.keywords) {
    if (normalizedType.includes(normalize(keyword))) {
      return { match: true, confidence: 0.9 };
    }
  }

  // Check if any keyword contains the business type
  for (const keyword of template.keywords) {
    if (normalize(keyword).includes(normalizedType)) {
      return { match: true, confidence: 0.85 };
    }
  }

  return { match: false, confidence: 0 };
}

/**
 * Find the best fuzzy match for a business type.
 */
function findFuzzyMatch(
  businessType: string,
  templates: TemplateMetadata[]
): { templateId: string; confidence: number } | null {
  let bestMatch: { templateId: string; confidence: number } | null = null;

  for (const template of templates) {
    // Check similarity to template ID
    const idSimilarity = similarity(businessType, template.id);

    // Check similarity to template name
    const nameSimilarity = similarity(businessType, template.name);

    // Check similarity to each keyword
    let maxKeywordSimilarity = 0;
    for (const keyword of template.keywords) {
      const keywordSimilarity = similarity(businessType, keyword);
      maxKeywordSimilarity = Math.max(maxKeywordSimilarity, keywordSimilarity);
    }

    // Take the best similarity score
    const bestSimilarity = Math.max(idSimilarity, nameSimilarity, maxKeywordSimilarity);

    // Only consider matches above threshold
    if (bestSimilarity > 0.7 && (!bestMatch || bestSimilarity > bestMatch.confidence)) {
      bestMatch = {
        templateId: template.id,
        confidence: bestSimilarity,
      };
    }
  }

  return bestMatch;
}

/**
 * Category Matcher Service
 */
export const CategoryMatcher = {
  /**
   * Match a business type to a template.
   *
   * @param businessType - The business type string (e.g., "tutor", "bakery", "piano teacher")
   * @returns MatchResult with template ID and confidence
   */
  match(businessType: string): MatchResult {
    if (!businessType || businessType.trim() === '') {
      return {
        templateId: null,
        confidence: 0,
        matchType: 'none',
      };
    }

    const normalizedType = normalize(businessType);
    const templates = SpecLibrary.listTemplates();

    // 1. Exact match on template ID
    const exactMatch = templates.find((t) => normalize(t.id) === normalizedType);
    if (exactMatch) {
      return {
        templateId: exactMatch.id,
        confidence: 1.0,
        matchType: 'exact',
      };
    }

    // 2. Keyword matching
    const keywordMatches: { template: TemplateMetadata; confidence: number }[] = [];
    for (const template of templates) {
      const { match, confidence } = matchKeywords(businessType, template);
      if (match) {
        keywordMatches.push({ template, confidence });
      }
    }

    if (keywordMatches.length > 0) {
      // Sort by confidence descending
      keywordMatches.sort((a, b) => b.confidence - a.confidence);
      const best = keywordMatches[0];

      return {
        templateId: best.template.id,
        confidence: best.confidence,
        matchType: 'keyword',
        alternatives:
          keywordMatches.length > 1
            ? keywordMatches.slice(1, 3).map((m) => m.template.id)
            : undefined,
      };
    }

    // 3. Fuzzy matching
    const fuzzyMatch = findFuzzyMatch(businessType, templates);
    if (fuzzyMatch) {
      return {
        templateId: fuzzyMatch.templateId,
        confidence: fuzzyMatch.confidence,
        matchType: 'fuzzy',
      };
    }

    // 4. No match found
    return {
      templateId: null,
      confidence: 0,
      matchType: 'none',
    };
  },

  /**
   * Get all categories (template IDs).
   */
  getCategories(): string[] {
    return SpecLibrary.listTemplates().map((t) => t.id);
  },

  /**
   * Check if a business type would match any template.
   */
  hasMatch(businessType: string): boolean {
    const result = this.match(businessType);
    return result.templateId !== null;
  },
};
