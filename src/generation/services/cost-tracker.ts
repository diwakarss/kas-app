/**
 * LLM Cost Tracking Service
 *
 * Calculates and logs generation costs for budget visibility and optimization.
 */

import type { ModelInfo, GenerationResult } from '../types/providers';

/**
 * Cost breakdown for a generation request.
 */
export interface CostBreakdown {
  /** Cost for input tokens in USD */
  input_cost_usd: number;
  /** Cost for output tokens in USD */
  output_cost_usd: number;
  /** Total cost in USD */
  total_cost_usd: number;
  /** Token counts */
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  /** Model and provider info */
  model: {
    id: string;
    provider: string;
  };
}

/**
 * Generation metrics for tracking.
 */
export interface GenerationMetrics {
  /** Timestamp of generation */
  timestamp: string;
  /** Business type requested */
  business_type: string;
  /** Cost breakdown */
  cost: CostBreakdown;
  /** Latency in milliseconds */
  latency_ms: number;
  /** Whether generation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Aggregate cost summary.
 */
export interface CostSummary {
  /** Total cost in USD */
  total_cost_usd: number;
  /** Total generations */
  total_generations: number;
  /** Average cost per generation */
  avg_cost_usd: number;
  /** Total tokens used */
  total_tokens: number;
  /** Breakdown by provider */
  by_provider: Record<
    string,
    {
      cost_usd: number;
      generations: number;
      tokens: number;
    }
  >;
  /** Period start */
  period_start: string;
  /** Period end */
  period_end: string;
}

/**
 * In-memory metrics store (replace with persistent store in production).
 */
const metricsStore: GenerationMetrics[] = [];

/**
 * Calculate cost for a generation based on token usage and model pricing.
 */
export function calculateCost(
  usage: GenerationResult['usage'],
  modelInfo: ModelInfo
): CostBreakdown {
  const inputCost = (usage.input_tokens / 1000) * (modelInfo.cost_per_1k_input ?? 0);
  const outputCost = (usage.output_tokens / 1000) * (modelInfo.cost_per_1k_output ?? 0);

  return {
    input_cost_usd: inputCost,
    output_cost_usd: outputCost,
    total_cost_usd: inputCost + outputCost,
    tokens: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      total: usage.input_tokens + usage.output_tokens,
    },
    model: {
      id: modelInfo.model_id,
      provider: modelInfo.provider,
    },
  };
}

/**
 * Format cost as human-readable string.
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return `$${(costUsd * 100).toFixed(4)}¢`;
  }
  return `$${costUsd.toFixed(4)}`;
}

/**
 * Log generation metrics for tracking.
 */
export function logGenerationMetrics(metrics: GenerationMetrics): void {
  metricsStore.push(metrics);

  // Log to console for visibility
  const costStr = formatCost(metrics.cost.total_cost_usd);
  const tokensStr = `${metrics.cost.tokens.input}/${metrics.cost.tokens.output}`;

  if (metrics.success) {
    console.log(
      `[CostTracker] ${metrics.business_type}: ${costStr} (${tokensStr} tokens, ${metrics.latency_ms}ms) [${metrics.cost.model.provider}]`
    );
  } else {
    console.warn(
      `[CostTracker] ${metrics.business_type}: FAILED after ${costStr} (${tokensStr} tokens) - ${metrics.error}`
    );
  }
}

/**
 * Get cost summary for a time period.
 */
export function getCostSummary(
  startDate?: Date,
  endDate?: Date
): CostSummary {
  const start = startDate ?? new Date(0);
  const end = endDate ?? new Date();

  const filtered = metricsStore.filter((m) => {
    const ts = new Date(m.timestamp);
    return ts >= start && ts <= end;
  });

  const byProvider: CostSummary['by_provider'] = {};

  let totalCost = 0;
  let totalTokens = 0;

  for (const m of filtered) {
    totalCost += m.cost.total_cost_usd;
    totalTokens += m.cost.tokens.total;

    const provider = m.cost.model.provider;
    if (!byProvider[provider]) {
      byProvider[provider] = { cost_usd: 0, generations: 0, tokens: 0 };
    }
    byProvider[provider].cost_usd += m.cost.total_cost_usd;
    byProvider[provider].generations += 1;
    byProvider[provider].tokens += m.cost.tokens.total;
  }

  return {
    total_cost_usd: totalCost,
    total_generations: filtered.length,
    avg_cost_usd: filtered.length > 0 ? totalCost / filtered.length : 0,
    total_tokens: totalTokens,
    by_provider: byProvider,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
  };
}

/**
 * Get all metrics (for export/analysis).
 */
export function getAllMetrics(): GenerationMetrics[] {
  return [...metricsStore];
}

/**
 * Clear metrics store (for testing).
 */
export function clearMetrics(): void {
  metricsStore.length = 0;
}

/**
 * Create generation metrics from a result.
 */
export function createMetrics(
  businessType: string,
  usage: GenerationResult['usage'],
  latencyMs: number,
  modelInfo: ModelInfo,
  success: boolean,
  error?: string
): GenerationMetrics {
  return {
    timestamp: new Date().toISOString(),
    business_type: businessType,
    cost: calculateCost(usage, modelInfo),
    latency_ms: latencyMs,
    success,
    error,
  };
}
