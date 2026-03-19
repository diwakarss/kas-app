import React from 'react';
import { View, Text } from 'react-native';
import type { Warning } from '../engines/business-rules-engine';

interface WarningBadgeProps {
  warning: Warning;
}

function WarningBadge({ warning }: WarningBadgeProps) {
  const bgColor = warning.severity === 'urgent'
    ? 'bg-ember/15'
    : warning.severity === 'warning'
    ? 'bg-ember/10'
    : 'bg-stream/10';

  const textColor = warning.severity === 'urgent' || warning.severity === 'warning'
    ? 'text-ember'
    : 'text-stream';

  const fontWeight = warning.severity === 'urgent'
    ? 'font-inter-semibold'
    : 'font-inter-medium';

  return (
    <View accessibilityRole="alert" accessibilityLabel={warning.message} className={`self-start rounded-full px-3 py-1 ${bgColor}`}>
      <Text className={`text-xs ${textColor} ${fontWeight}`}>
        {warning.message}
      </Text>
    </View>
  );
}

interface WarningTextBadgeProps {
  text: string;
}

function WarningTextBadgeInner({ text }: WarningTextBadgeProps) {
  return (
    <View accessibilityRole="alert" accessibilityLabel={text} className="self-start rounded-full px-3 py-1 bg-ember/10">
      <Text className="text-xs text-ember font-inter-medium">
        {text}
      </Text>
    </View>
  );
}

export const WarningTextBadge = React.memo(WarningTextBadgeInner);

export default React.memo(WarningBadge);
