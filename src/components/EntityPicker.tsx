import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors } from '../core/theme/tokens';

interface EntityPickerProps {
  options: Record<string, any>[];
  entityDisplayName: string;
  value: number | null;
  onChange: (id: number) => void;
}

export default function EntityPicker({ options, entityDisplayName, value, onChange }: EntityPickerProps) {
  if (options.length === 0) {
    return (
      <View className="py-4">
        <Text className="font-inter text-sm text-mist italic">
          No {entityDisplayName.toLowerCase()}s found. Create one first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ maxHeight: 300 }}>
      {options.map(opt => {
        const displayText = opt.name || opt.content || `#${opt.id}`;
        const isSelected = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            className="px-5 py-4"
            style={{
              borderBottomWidth: 1, borderBottomColor: colors.mist + '20',
              backgroundColor: isSelected ? colors.stream + '10' : 'transparent',
              borderRadius: isSelected ? 12 : 0,
            }}
            accessibilityLabel={displayText}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              className={isSelected ? 'font-inter-medium' : 'font-inter'}
              style={{
                fontSize: 18,
                color: isSelected ? colors.stream : colors.clay,
              }}
            >
              {displayText}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
