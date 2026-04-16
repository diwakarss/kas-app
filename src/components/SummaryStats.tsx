import React from 'react';
import { View, Text } from 'react-native';
import { cardShadow } from '../core/theme/tokens';

interface StatTrend {
  direction: 'up' | 'down' | 'flat';
  label: string;
}

interface Stat {
  label: string;
  value: number | string;
  trend?: StatTrend | null;
}

interface SummaryStatsProps {
  stats: Stat[];
}

const TREND_COLOR: Record<StatTrend['direction'], string> = {
  up: 'text-bloom',
  down: 'text-ember',
  flat: 'text-mist',
};

const TREND_GLYPH: Record<StatTrend['direction'], string> = {
  up: '▲',
  down: '▼',
  flat: '•',
};

function SummaryStats({ stats }: SummaryStatsProps) {
  if (stats.length === 0) return null;

  return (
    <View accessibilityRole="summary" className="flex-row mx-5 mb-4 rounded-2xl bg-white p-4" style={cardShadow}>
      {stats.map((stat, index) => {
        const a11yLabel = stat.trend
          ? `${stat.label}: ${stat.value}, ${stat.trend.label} vs last week`
          : `${stat.label}: ${stat.value}`;
        return (
          <View
            key={stat.label}
            accessibilityLabel={a11yLabel}
            className={`flex-1 items-center ${index > 0 ? 'border-l border-mist/20' : ''}`}
          >
            <Text className="font-inter-semibold text-2xl text-clay">
              {stat.value}
            </Text>
            <Text className="mt-1 font-inter text-xs text-mist">
              {stat.label}
            </Text>
            {stat.trend ? (
              <Text className={`mt-0.5 font-inter-medium text-xs ${TREND_COLOR[stat.trend.direction]}`}>
                {TREND_GLYPH[stat.trend.direction]} {stat.trend.label}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(SummaryStats);
