import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '../core/theme/tokens';
import type { CalendarDayEvent } from '../hooks/useCalendarData';

interface DayDetailProps {
  date: string;
  events: CalendarDayEvent[];
  onEventPress: (entityType: string, entityId: number) => void;
}

function formatDayHeader(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
  } catch {
    return dateStr;
  }
}

function formatEventTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${period}`;
  } catch {
    return '';
  }
}

function DayDetail({ date, events, onEventPress }: DayDetailProps) {
  if (events.length === 0) {
    return (
      <View className="px-5 py-4">
        <Text className="font-inter-medium text-base text-clay mb-2">
          {formatDayHeader(date)}
        </Text>
        <Text className="font-inter text-sm text-mist italic">No events</Text>
      </View>
    );
  }

  return (
    <View className="px-5 py-4">
      <Text className="font-inter-medium text-base text-clay mb-3">
        {formatDayHeader(date)}
      </Text>
      {events.map(event => (
        <Pressable
          key={event.id}
          onPress={() => onEventPress(event.entityType, event.id)}
          accessibilityRole="button"
          accessibilityLabel={`${formatEventTime(event.sortDate)}, ${event.display}`}
          className="flex-row items-center py-2.5"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.mist + '15' }}
        >
          <Text className="font-inter-medium text-sm text-stream" style={{ width: 72 }}>
            {formatEventTime(event.sortDate)}
          </Text>
          <Text className="font-inter text-sm text-clay flex-1" numberOfLines={1}>
            {event.display}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default React.memo(DayDetail);
