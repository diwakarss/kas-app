import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { useCalendarData } from '../hooks/useCalendarData';
import MonthGrid from '../components/MonthGrid';
import DayDetail from '../components/DayDetail';
import FloatingActions from '../components/FloatingActions';
import { colors } from '../core/theme/tokens';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const calData = useCalendarData();

  if (!calData) {
    return (
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter text-sm text-mist">No calendar configured</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleEventPress = (entityType: string, entityId: number) => {
    // Navigate to the related student's story (via the class's student_id)
    // For now, we navigate to the entity itself — story screen handles resolution
    navigation.navigate('Story', { entityType, entityId });
  };

  return (
    <SafeAreaView className="flex-1 bg-dawn">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
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

        <MonthGrid
          year={calData.year}
          month={calData.month}
          events={calData.events}
          selectedDate={calData.selectedDate}
          onSelectDate={calData.selectDate}
        />

        {calData.selectedDate && (
          <View className="mt-4" style={{ borderTopWidth: 1, borderTopColor: colors.mist + '20' }}>
            <DayDetail
              date={calData.selectedDate}
              events={calData.selectedEvents}
              onEventPress={handleEventPress}
            />
          </View>
        )}
      </ScrollView>
      <FloatingActions />
    </SafeAreaView>
  );
}
