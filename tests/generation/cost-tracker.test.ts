/**
 * Cost Tracker Tests
 *
 * Tests for LLM generation cost calculation and tracking.
 */

import {
  calculateCost,
  formatCost,
  logGenerationMetrics,
  getCostSummary,
  getAllMetrics,
  clearMetrics,
  createMetrics,
} from '../../src/generation/services/cost-tracker';
import type { ModelInfo, GenerationResult } from '../../src/generation/types/providers';

describe('Cost Tracker', () => {
  beforeEach(() => {
    clearMetrics();
  });

  describe('calculateCost', () => {
    it('should calculate cost for DeepInfra Qwen model', () => {
      const usage: GenerationResult['usage'] = {
        input_tokens: 1000,
        output_tokens: 2000,
      };

      const modelInfo: ModelInfo = {
        model_id: 'Qwen/Qwen3-30B-A3B',
        provider: 'deepinfra',
        max_context_tokens: 32768,
        cost_per_1k_input: 0.00008,
        cost_per_1k_output: 0.00028,
      };

      const cost = calculateCost(usage, modelInfo);

      expect(cost.input_cost_usd).toBeCloseTo(0.00008, 6);
      expect(cost.output_cost_usd).toBeCloseTo(0.00056, 6);
      expect(cost.total_cost_usd).toBeCloseTo(0.00064, 6);
      expect(cost.tokens.input).toBe(1000);
      expect(cost.tokens.output).toBe(2000);
      expect(cost.tokens.total).toBe(3000);
      expect(cost.model.provider).toBe('deepinfra');
    });

    it('should calculate cost for OpenAI GPT-4o model', () => {
      const usage: GenerationResult['usage'] = {
        input_tokens: 1000,
        output_tokens: 2000,
      };

      const modelInfo: ModelInfo = {
        model_id: 'gpt-4o',
        provider: 'openai',
        max_context_tokens: 128000,
        cost_per_1k_input: 0.005,
        cost_per_1k_output: 0.015,
      };

      const cost = calculateCost(usage, modelInfo);

      expect(cost.input_cost_usd).toBeCloseTo(0.005, 6);
      expect(cost.output_cost_usd).toBeCloseTo(0.03, 6);
      expect(cost.total_cost_usd).toBeCloseTo(0.035, 6);
    });

    it('should handle zero costs for self-hosted models', () => {
      const usage: GenerationResult['usage'] = {
        input_tokens: 5000,
        output_tokens: 3000,
      };

      const modelInfo: ModelInfo = {
        model_id: 'Qwen/Qwen2.5-72B-Instruct',
        provider: 'qwen',
        max_context_tokens: 32768,
        // Self-hosted: no per-token costs
        cost_per_1k_input: 0,
        cost_per_1k_output: 0,
      };

      const cost = calculateCost(usage, modelInfo);

      expect(cost.total_cost_usd).toBe(0);
      expect(cost.tokens.total).toBe(8000);
    });

    it('should handle undefined cost fields', () => {
      const usage: GenerationResult['usage'] = {
        input_tokens: 1000,
        output_tokens: 1000,
      };

      const modelInfo: ModelInfo = {
        model_id: 'unknown-model',
        provider: 'unknown',
        max_context_tokens: 4096,
        // No cost fields defined
      };

      const cost = calculateCost(usage, modelInfo);

      expect(cost.total_cost_usd).toBe(0);
    });
  });

  describe('formatCost', () => {
    it('should format small costs in cents', () => {
      expect(formatCost(0.00064)).toBe('$0.0640¢');
      expect(formatCost(0.001)).toBe('$0.1000¢');
    });

    it('should format larger costs in dollars', () => {
      expect(formatCost(0.035)).toBe('$0.0350');
      expect(formatCost(1.5)).toBe('$1.5000');
    });

    it('should handle zero cost', () => {
      expect(formatCost(0)).toBe('$0.0000¢');
    });
  });

  describe('logGenerationMetrics', () => {
    it('should log successful generation metrics', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const modelInfo: ModelInfo = {
        model_id: 'Qwen/Qwen3-30B-A3B',
        provider: 'deepinfra',
        max_context_tokens: 32768,
        cost_per_1k_input: 0.00008,
        cost_per_1k_output: 0.00028,
      };

      const metrics = createMetrics(
        'tutor',
        { input_tokens: 1000, output_tokens: 2000 },
        5000,
        modelInfo,
        true
      );

      logGenerationMetrics(metrics);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CostTracker] tutor:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('1000/2000 tokens')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('5000ms')
      );

      consoleSpy.mockRestore();
    });

    it('should log failed generation with warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const modelInfo: ModelInfo = {
        model_id: 'gpt-4o',
        provider: 'openai',
        max_context_tokens: 128000,
      };

      const metrics = createMetrics(
        'unknown-type',
        { input_tokens: 500, output_tokens: 0 },
        3000,
        modelInfo,
        false,
        'API timeout'
      );

      logGenerationMetrics(metrics);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CostTracker] unknown-type: FAILED')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API timeout')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getCostSummary', () => {
    it('should return empty summary when no metrics', () => {
      const summary = getCostSummary();

      expect(summary.total_cost_usd).toBe(0);
      expect(summary.total_generations).toBe(0);
      expect(summary.avg_cost_usd).toBe(0);
      expect(summary.total_tokens).toBe(0);
      expect(Object.keys(summary.by_provider)).toHaveLength(0);
    });

    it('should aggregate metrics correctly', () => {
      const modelInfo1: ModelInfo = {
        model_id: 'Qwen/Qwen3-30B-A3B',
        provider: 'deepinfra',
        max_context_tokens: 32768,
        cost_per_1k_input: 0.00008,
        cost_per_1k_output: 0.00028,
      };

      const modelInfo2: ModelInfo = {
        model_id: 'gpt-4o',
        provider: 'openai',
        max_context_tokens: 128000,
        cost_per_1k_input: 0.005,
        cost_per_1k_output: 0.015,
      };

      // Suppress console output
      jest.spyOn(console, 'log').mockImplementation();

      // Log some metrics
      logGenerationMetrics(
        createMetrics('tutor', { input_tokens: 1000, output_tokens: 2000 }, 5000, modelInfo1, true)
      );
      logGenerationMetrics(
        createMetrics('doctor', { input_tokens: 1000, output_tokens: 2000 }, 4000, modelInfo1, true)
      );
      logGenerationMetrics(
        createMetrics('boutique', { input_tokens: 1000, output_tokens: 2000 }, 6000, modelInfo2, true)
      );

      const summary = getCostSummary();

      expect(summary.total_generations).toBe(3);
      expect(summary.total_tokens).toBe(9000); // 3 * 3000
      expect(summary.by_provider['deepinfra'].generations).toBe(2);
      expect(summary.by_provider['openai'].generations).toBe(1);

      jest.restoreAllMocks();
    });

    it('should filter by date range', () => {
      const modelInfo: ModelInfo = {
        model_id: 'Qwen/Qwen3-30B-A3B',
        provider: 'deepinfra',
        max_context_tokens: 32768,
        cost_per_1k_input: 0.00008,
        cost_per_1k_output: 0.00028,
      };

      jest.spyOn(console, 'log').mockImplementation();

      logGenerationMetrics(
        createMetrics('tutor', { input_tokens: 1000, output_tokens: 1000 }, 5000, modelInfo, true)
      );

      // Get summary for future dates (should be empty)
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const summary = getCostSummary(futureDate);

      expect(summary.total_generations).toBe(0);

      jest.restoreAllMocks();
    });
  });

  describe('getAllMetrics', () => {
    it('should return all logged metrics', () => {
      const modelInfo: ModelInfo = {
        model_id: 'test-model',
        provider: 'test',
        max_context_tokens: 4096,
      };

      jest.spyOn(console, 'log').mockImplementation();

      logGenerationMetrics(
        createMetrics('type1', { input_tokens: 100, output_tokens: 100 }, 1000, modelInfo, true)
      );
      logGenerationMetrics(
        createMetrics('type2', { input_tokens: 200, output_tokens: 200 }, 2000, modelInfo, true)
      );

      const metrics = getAllMetrics();

      expect(metrics).toHaveLength(2);
      expect(metrics[0].business_type).toBe('type1');
      expect(metrics[1].business_type).toBe('type2');

      jest.restoreAllMocks();
    });

    it('should return a copy (not reference)', () => {
      const modelInfo: ModelInfo = {
        model_id: 'test-model',
        provider: 'test',
        max_context_tokens: 4096,
      };

      jest.spyOn(console, 'log').mockImplementation();

      logGenerationMetrics(
        createMetrics('test', { input_tokens: 100, output_tokens: 100 }, 1000, modelInfo, true)
      );

      const metrics1 = getAllMetrics();
      const metrics2 = getAllMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);

      jest.restoreAllMocks();
    });
  });

  describe('createMetrics', () => {
    it('should create complete metrics object', () => {
      const modelInfo: ModelInfo = {
        model_id: 'Qwen/Qwen3-30B-A3B',
        provider: 'deepinfra',
        max_context_tokens: 32768,
        cost_per_1k_input: 0.00008,
        cost_per_1k_output: 0.00028,
      };

      const metrics = createMetrics(
        'restaurant',
        { input_tokens: 1500, output_tokens: 2500 },
        7500,
        modelInfo,
        true
      );

      expect(metrics.business_type).toBe('restaurant');
      expect(metrics.latency_ms).toBe(7500);
      expect(metrics.success).toBe(true);
      expect(metrics.error).toBeUndefined();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.cost.tokens.input).toBe(1500);
      expect(metrics.cost.tokens.output).toBe(2500);
      expect(metrics.cost.model.provider).toBe('deepinfra');
    });

    it('should include error message for failed generations', () => {
      const modelInfo: ModelInfo = {
        model_id: 'gpt-4o',
        provider: 'openai',
        max_context_tokens: 128000,
      };

      const metrics = createMetrics(
        'unknown',
        { input_tokens: 0, output_tokens: 0 },
        0,
        modelInfo,
        false,
        'Connection refused'
      );

      expect(metrics.success).toBe(false);
      expect(metrics.error).toBe('Connection refused');
    });
  });
});
