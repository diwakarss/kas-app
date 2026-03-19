import React from 'react';
import { View, Text } from 'react-native';

interface StatsCardProps {
  items: { label: string; value: string }[];
}

export default function StatsCard({ items }: StatsCardProps) {
  if (items.length === 0) return null;

  return (
    <View
      className="mx-5 mb-4 rounded-2xl bg-white p-4"
      style={{
        shadowColor: '#3D3530',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="flex-row justify-around">
        {items.map((item, i) => (
          <View key={i} className="items-center flex-1">
            <Text className="font-inter-medium text-base text-clay text-center" numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
