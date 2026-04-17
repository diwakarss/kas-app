import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { useSpec } from '../core/context/SpecContext';
import { colors } from '../core/theme/tokens';
import type { ChatCommand } from '../core/types/spec';

interface ChatOverlayProps {
  visible: boolean;
  onClose: () => void;
}

function commandLabel(cmd: ChatCommand): string {
  const pattern = cmd.pattern.replace(/\{[^}]+\}/g, '…');
  return pattern.charAt(0).toUpperCase() + pattern.slice(1);
}

function groupCommands(commands: ChatCommand[]): Record<string, ChatCommand[]> {
  const groups: Record<string, ChatCommand[]> = {};
  for (const cmd of commands) {
    const key = cmd.action.type === 'addEntity' ? 'Add' : cmd.action.type === 'navigate' ? 'Navigate' : 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(cmd);
  }
  return groups;
}

export default function ChatOverlay({ visible, onClose }: ChatOverlayProps) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { spec } = useSpec();
  const commands = (spec?.chat_commands ?? []) as ChatCommand[];
  const grouped = useMemo(() => groupCommands(commands), [commands]);

  const handleCommand = (cmd: ChatCommand) => {
    onClose();
    const action = cmd.action;
    if (action.type === 'addEntity' && action.entity) {
      navigation.navigate('AddFlow', { entityType: action.entity });
    } else if (action.type === 'navigate') {
      navigation.navigate('Anchor');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-row items-center px-5 py-2">
          <Pressable onPress={onClose} accessibilityLabel="Close chat" accessibilityRole="button">
            <Text className="font-inter-medium text-base text-stream">{'\u2715'} Close</Text>
          </Pressable>
        </View>

        <View className="px-5 pb-4">
          <Text className="font-inter-semibold text-2xl text-clay">Ask anything</Text>
          <Text className="font-inter text-sm text-mist mt-1">
            Tap a suggestion to get started.
          </Text>
        </View>

        {commands.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="font-inter text-sm text-mist text-center">
              No suggestions available yet.
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {Object.entries(grouped).map(([groupLabel, groupCmds]) => (
              <View key={groupLabel} className="mb-5">
                <Text className="px-5 mb-2 font-inter-medium text-xs uppercase text-mist tracking-wide">
                  {groupLabel}
                </Text>
                <View className="px-5 flex-row flex-wrap gap-2">
                  {groupCmds.map((cmd, i) => (
                    <Pressable
                      key={`${cmd.pattern}-${i}`}
                      onPress={() => handleCommand(cmd)}
                      accessibilityRole="button"
                      accessibilityLabel={commandLabel(cmd)}
                      className="rounded-full px-4 py-2"
                      style={{ backgroundColor: colors.stream + '18', borderWidth: 1, borderColor: colors.stream + '30' }}
                    >
                      <Text className="font-inter text-sm text-stream">{commandLabel(cmd)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
