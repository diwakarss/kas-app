import React from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';
import { colors } from '../core/theme/tokens';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  autoFocus?: boolean;
}

export default function SearchBar({ value, onChangeText, onClear, autoFocus }: SearchBarProps) {
  return (
    <View
      className="flex-row items-center mx-5 rounded-full px-4"
      style={{
        backgroundColor: colors.dawn,
        borderWidth: 1.5,
        borderColor: colors.mist + '50',
        height: 44,
      }}
    >
      <Text className="text-mist mr-2" style={{ fontSize: 16 }}>{'\uD83D\uDD0D'}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search..."
        placeholderTextColor={colors.mist}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16,
          color: colors.clay, paddingVertical: 8,
        }}
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} className="p-1">
          <Text className="text-mist" style={{ fontSize: 16 }}>{'\u2715'}</Text>
        </Pressable>
      )}
    </View>
  );
}
