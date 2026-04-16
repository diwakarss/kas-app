import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../core/theme/tokens';

interface DetailRowProps {
  label: string;
  value: string;
}

export default function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    }}>
      <Text style={{
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: colors.mist,
        flex: 1,
      }}>
        {label}
      </Text>
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: colors.clay,
        flex: 2,
        textAlign: 'right',
      }}>
        {value}
      </Text>
    </View>
  );
}
