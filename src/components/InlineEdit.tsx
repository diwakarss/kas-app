import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { colors } from '../core/theme/tokens';

interface InlineEditProps {
  label: string;
  value: string;
  isEditing: boolean;
  editValue: any;
  onStartEdit: () => void;
  onChangeValue: (val: any) => void;
  onSave: () => void;
  onCancel: () => void;
  editable?: boolean;
  keyboardType?: 'default' | 'number-pad';
}

export default function InlineEdit({
  label,
  value,
  isEditing,
  editValue,
  onStartEdit,
  onChangeValue,
  onSave,
  onCancel,
  editable = true,
  keyboardType = 'default',
}: InlineEditProps) {
  if (isEditing) {
    return (
      <View className="flex-row items-center">
        <TextInput
          value={String(editValue ?? '')}
          onChangeText={onChangeValue}
          keyboardType={keyboardType}
          autoFocus
          style={{
            flex: 1, fontFamily: 'Inter_500Medium', fontSize: 16,
            borderBottomWidth: 2, borderBottomColor: colors.stream,
            paddingVertical: 4, color: colors.clay,
          }}
        />
        <Pressable onPress={onSave} className="ml-2 px-3 py-1 rounded-lg" style={{ backgroundColor: colors.bloom }}>
          <Text className="font-inter-medium text-xs" style={{ color: colors.dawn }}>Save</Text>
        </Pressable>
        <Pressable onPress={onCancel} className="ml-1 px-3 py-1">
          <Text className="font-inter-medium text-xs text-mist">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={editable ? onStartEdit : undefined}
      className="flex-row items-center"
    >
      <Text className="font-inter-medium text-base text-clay">{value}</Text>
      {editable && (
        <Text className="ml-1.5 text-mist" style={{ fontSize: 12 }}>{'\u270E'}</Text>
      )}
    </Pressable>
  );
}
