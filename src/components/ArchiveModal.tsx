import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { colors } from '../core/theme/tokens';

interface ArchiveModalProps {
  visible: boolean;
  entityName: string;
  entityIcon: string;
  eventCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ArchiveModal({
  visible,
  entityName,
  entityIcon,
  eventCount,
  onConfirm,
  onCancel,
}: ArchiveModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View
          className="mx-8 rounded-2xl p-6 items-center"
          accessibilityRole="alert"
          accessibilityLabel="Confirm archive"
          style={{
            backgroundColor: colors.dawn,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
            width: 300,
          }}
        >
          <Text style={{ fontSize: 40, marginBottom: 12 }}>{entityIcon}</Text>
          <Text className="font-inter-semibold text-lg text-clay text-center mb-2">
            Remove {entityName}?
          </Text>
          <Text className="font-inter text-sm text-mist text-center mb-6">
            {eventCount > 0
              ? `${eventCount} items of history will be archived`
              : 'This record will be archived'}
          </Text>
          <View className="flex-row" style={{ gap: 12 }}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="flex-1 items-center py-3 rounded-xl"
              style={{ borderWidth: 1.5, borderColor: colors.mist + '40' }}
            >
              <Text className="font-inter-medium text-sm text-clay">Keep</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirm archive"
              className="flex-1 items-center py-3 rounded-xl"
              style={{ backgroundColor: colors.ember }}
            >
              <Text className="font-inter-medium text-sm" style={{ color: colors.dawn }}>Archive</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
