/**
 * LLM Adaptation Layer Tests
 */

import { extractJSON, parseResponse } from '../../src/generation/services/llm-adaptation';

describe('LLMAdaptation', () => {
  describe('extractJSON', () => {
    it('extracts JSON from plain text', () => {
      const text = '{"name": "Test"}';
      const result = extractJSON(text);

      expect(result).toBe('{"name": "Test"}');
    });

    it('extracts JSON from markdown code block', () => {
      const text = 'Here is the spec:\n```json\n{"name": "Test"}\n```';
      const result = extractJSON(text);

      expect(result).toBe('{"name": "Test"}');
    });

    it('extracts JSON from code block without language', () => {
      const text = 'Result:\n```\n{"name": "Test"}\n```';
      const result = extractJSON(text);

      expect(result).toBe('{"name": "Test"}');
    });

    it('extracts JSON with surrounding text', () => {
      const text = 'Based on your requirements, {"name": "Test"} is the spec.';
      const result = extractJSON(text);

      expect(result).toBe('{"name": "Test"}');
    });

    it('returns null when no JSON found', () => {
      const text = 'This is just plain text without any JSON.';
      const result = extractJSON(text);

      expect(result).toBeNull();
    });

    it('handles multiline JSON', () => {
      const text = '```json\n{\n  "name": "Test",\n  "version": 1\n}\n```';
      const result = extractJSON(text);

      expect(result).toContain('"name": "Test"');
      expect(result).toContain('"version": 1');
    });
  });

  describe('parseResponse', () => {
    it('parses valid JSON response', () => {
      const text = '{"meta": {"name": "Test", "version": 1, "spec_id": "test"}}';
      const result = parseResponse(text);

      expect(result.meta.name).toBe('Test');
    });

    it('parses JSON from markdown code block', () => {
      const text = '```json\n{"meta": {"name": "Test", "version": 1}}\n```';
      const result = parseResponse(text);

      expect(result.meta.name).toBe('Test');
    });

    it('repairs trailing commas', () => {
      const text = '{"meta": {"name": "Test",}}';
      const result = parseResponse(text);

      expect(result.meta.name).toBe('Test');
    });

    it('throws on invalid JSON', () => {
      const text = 'not valid json at all';

      expect(() => parseResponse(text)).toThrow('No JSON found');
    });

    it('throws on malformed JSON', () => {
      const text = '{"name": "unclosed string}';

      expect(() => parseResponse(text)).toThrow('Failed to parse');
    });
  });
});
