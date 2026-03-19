import React from 'react';
import { View, Text } from 'react-native';

interface Stat {
  label: string;
  value: number | string;
}

interface SummaryStatsProps {
  stats: Stat[];
}

function SummaryStats({ stats }: SummaryStatsProps) {
  if (stats.length === 0) return null;

  return (
    <View accessibilityRole="summary" className="flex-row mx-5 mb-4 rounded-2xl bg-white p-4"
      style={{
        shadowColor: '#3D3530',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      {stats.map((stat, index) => (
        <View
          key={stat.label}
          accessibilityLabel={`${stat.label}: ${stat.value}`}
          className={`flex-1 items-center ${index > 0 ? 'border-l border-mist/20' : ''}`}
        >
          <Text className="font-inter-semibold text-2xl text-clay">
            {stat.value}
          </Text>
          <Text className="mt-1 font-inter text-xs text-mist">
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default React.memo(SummaryStats);
