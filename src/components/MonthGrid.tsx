import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors, resolveColor } from '../core/theme/tokens';

interface MonthGridProps {
  year: number;
  month: number;
  events: Record<string, { statusColor: string }[]>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // Monday = 0, Sunday = 6
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function MonthGrid({ year, month, events, selectedDate, onSelectDate }: MonthGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View className="px-3">
      <View className="flex-row mb-2">
        {DAY_NAMES.map(d => (
          <View key={d} className="flex-1 items-center">
            <Text className="font-inter text-xs text-mist">{d}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }).map((_, row) => (
        <View key={row} className="flex-row">
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (day === null) {
              return <View key={`empty-${col}`} className="flex-1 items-center py-1.5" />;
            }
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dayEvents = events[dateStr];
            const hasDot = dayEvents && dayEvents.length > 0;
            const dotColor = hasDot ? resolveColor(dayEvents[0].statusColor) : undefined;

            return (
              <Pressable
                key={day}
                onPress={() => onSelectDate(dateStr)}
                className="flex-1 items-center py-1.5"
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isSelected ? colors.stream : isToday ? colors.clay : 'transparent',
                  }}
                >
                  <Text
                    className="font-inter text-sm"
                    style={{ color: isSelected || isToday ? colors.dawn : colors.clay }}
                  >
                    {day}
                  </Text>
                </View>
                {hasDot && (
                  <View
                    style={{
                      width: 5, height: 5, borderRadius: 2.5,
                      backgroundColor: dotColor, marginTop: 2,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
