import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../core/theme/tokens';

interface SectionHeaderProps {
  title: string;
  count?: number;
}

export default function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center px-5 py-2">
      <Text className="font-inter-medium text-base text-clay">{title}</Text>
      {count !== undefined && (
        <View
          className="rounded-full px-2 py-0.5 ml-2"
          style={{ backgroundColor: colors.mist + '25' }}
        >
          <Text className="font-inter text-xs text-mist">{count}</Text>
        </View>
      )}
    </View>
  );
}
