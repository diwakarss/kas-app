import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../core/theme/tokens';

interface StepProgressProps {
  current: number;
  total: number;
}

export default function StepProgress({ current, total }: StepProgressProps) {
  return (
    <View className="flex-row items-center px-5 py-2">
      <Text className="font-inter text-sm text-mist">{current + 1} of {total}</Text>
      <View className="flex-row ml-3" style={{ gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              width: i === current ? 16 : 6, height: 6, borderRadius: 3,
              backgroundColor: i <= current ? colors.stream : colors.mist + '40',
            }}
          />
        ))}
      </View>
    </View>
  );
}
