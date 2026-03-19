import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../core/theme/tokens';

interface ComingUpCardProps {
  display: string;
  sortDate: string;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${monthNames[date.getMonth()]}`;
  } catch {
    return '';
  }
}

function ComingUpCard({ display, sortDate }: ComingUpCardProps) {
  return (
    <View accessibilityRole="summary" accessibilityLabel={display} className="flex-row px-5 py-2 items-center">
      <View
        className="rounded-lg px-2.5 py-1 mr-3"
        style={{ backgroundColor: colors.stream + '15' }}
      >
        <Text className="font-inter-medium text-xs text-stream">
          {formatShortDate(sortDate)}
        </Text>
      </View>
      <Text className="font-inter text-sm text-clay flex-1" numberOfLines={1}>
        {display}
      </Text>
    </View>
  );
}

export default React.memo(ComingUpCard);
