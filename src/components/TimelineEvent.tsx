import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../core/theme/tokens';

interface TimelineEventProps {
  display: string;
  iconColor: string;
  sortDate: string;
  isLast: boolean;
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const hours = date.getHours();
    const mins = String(date.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${day} ${month} \u00B7 ${h12}:${mins} ${period}`;
  } catch {
    return dateStr;
  }
}

function TimelineEvent({ display, iconColor, sortDate, isLast }: TimelineEventProps) {
  return (
    <View accessible={true} accessibilityLabel={`${display}, ${formatEventDate(sortDate)}`} className="flex-row px-5" style={{ minHeight: 48 }}>
      <View className="items-center" style={{ width: 24 }}>
        <View style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: iconColor, marginTop: 4,
        }} />
        {!isLast && (
          <View style={{ width: 2, flex: 1, backgroundColor: colors.mist, opacity: 0.4 }} />
        )}
      </View>
      <View className="flex-1 pl-3 pb-4">
        <Text className="font-inter text-sm text-clay">{display}</Text>
        <Text className="font-inter text-xs text-mist mt-0.5">
          {formatEventDate(sortDate)}
        </Text>
      </View>
    </View>
  );
}

export default React.memo(TimelineEvent);
