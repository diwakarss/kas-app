import React from 'react';
import { View, Text } from 'react-native';

interface GreetingProps {
  greeting: string;
  dateLabel: string;
}

export default function Greeting({ greeting, dateLabel }: GreetingProps) {
  return (
    <View className="px-5 pt-4 pb-2">
      <Text
        className="font-inter-semibold text-xl text-clay"
        accessibilityRole="header"
      >
        {greeting}
      </Text>
      <Text className="mt-1 font-inter text-sm text-mist capitalize">
        {dateLabel}
      </Text>
    </View>
  );
}
