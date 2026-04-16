import React from 'react';
import { View, Text } from 'react-native';
import { WarningTextBadge } from './WarningBadge';
import AnimatedPressable from './AnimatedPressable';
import { cardShadow } from '../core/theme/tokens';

interface EntityCardProps {
  title: string;
  subtitle: string;
  time: string;
  warningText: string | null;
  onPress?: () => void;
}

function EntityCard({
  title,
  subtitle,
  time,
  warningText,
  onPress,
}: EntityCardProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}, ${formatTime(time)}`}
      className="mx-5 mb-3 rounded-2xl bg-white p-4"
      style={cardShadow}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="font-inter-semibold text-base text-clay" numberOfLines={1}>
            {title}
          </Text>
          <Text className="mt-1 font-inter text-sm text-mist" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text className="font-inter-medium text-sm text-stream">
          {formatTime(time)}
        </Text>
      </View>
      {warningText && (
        <View className="mt-3">
          <WarningTextBadge text={warningText} />
        </View>
      )}
    </AnimatedPressable>
  );
}

function formatTime(time: string): string {
  // If it's already a short time like "10:00", convert to 12hr format
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }
  // If it's an ISO datetime, extract and format the time
  if (time.includes('T')) {
    const date = new Date(time);
    const h = date.getHours();
    const m = date.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }
  return time;
}

export default React.memo(EntityCard);
