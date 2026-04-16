import React from 'react';
import { View, Text } from 'react-native';
import { cardShadow } from '../core/theme/tokens';

interface StatsCardProps {
  items: { label: string; value: string }[];
}

export default function StatsCard({ items }: StatsCardProps) {
  if (items.length === 0) return null;

  return (
    <View className="mx-5 mb-4 rounded-2xl bg-white p-4" style={cardShadow}>
      <View className="flex-row justify-around">
        {items.map((item, i) => (
          <View
            key={i}
            className="items-center flex-1"
            accessibilityLabel={`${item.label}, ${item.value}`}
          >
            <Text className="font-inter text-xs text-mist text-center" numberOfLines={1}>
              {item.label}
            </Text>
            <Text
              className="mt-1 font-inter-semibold text-xl text-clay text-center"
              numberOfLines={1}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
