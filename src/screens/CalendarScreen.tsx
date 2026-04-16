import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { ActionProvider, Renderer, StateProvider } from '@json-render/react-native';
import { useSpec } from '../core/context/SpecContext';
import { useCalendarData } from '../hooks/useCalendarData';
import { ensureV2 } from '../core/types/kas-spec-v2';
import { buildCalendarSpec } from '../ui/spec-builders/calendar';
import { registry } from '../ui/registry';
import { colors } from '../core/theme/tokens';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { spec } = useSpec();
  const calData = useCalendarData();

  const uiSpec = useMemo(() => {
    if (!calData || !spec) return null;
    return buildCalendarSpec(calData, ensureV2(spec));
  }, [calData, spec]);

  const actionHandlers = useMemo(() => ({
    navigate: async (params: Record<string, unknown>) => {
      navigation.navigate('Story', {
        entityType: params.entityType as string,
        entityId: params.entityId as number,
      });
    },
    addEntity: async (params: Record<string, unknown>) => {
      navigation.navigate('AddFlow', {
        entityType: params.entityType as string,
      });
    },
  }), [navigation]);

  if (!calData) {
    return (
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter text-sm text-mist">No calendar configured</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-dawn">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Navigation — stays imperative (back + month nav) */}
        <Pressable
          onPress={() => navigation.goBack()}
          className="px-5 py-3"
        >
          <Text className="font-inter-medium text-base text-stream">{'\u2190'} Back</Text>
        </Pressable>

        <View className="flex-row items-center justify-between px-5 mb-4">
          <Pressable onPress={calData.prevMonth} className="p-2">
            <Text className="font-inter-medium text-lg text-stream">{'\u2039'}</Text>
          </Pressable>
          <Text className="font-inter-semibold text-lg text-clay">
            {MONTH_NAMES[calData.month - 1]} {calData.year}
          </Text>
          <Pressable onPress={calData.nextMonth} className="p-2">
            <Text className="font-inter-medium text-lg text-stream">{'\u203A'}</Text>
          </Pressable>
        </View>

        {/* Calendar content via json-render */}
        {uiSpec && (
          <StateProvider>
            <ActionProvider handlers={actionHandlers}>
              <Renderer spec={uiSpec} registry={registry} />
            </ActionProvider>
          </StateProvider>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
