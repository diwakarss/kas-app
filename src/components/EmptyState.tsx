import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface EmptyStateProps {
  message: string;
  action: string | null;
  onAction?: () => void;
}

export default function EmptyState({ message, action, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="font-inter-medium text-base text-mist text-center">
        {message}
      </Text>
      {action && (
        <Pressable
          onPress={onAction}
          className="mt-4 rounded-full bg-stream/10 px-6 py-3"
        >
          <Text className="font-inter-medium text-sm text-stream">
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
