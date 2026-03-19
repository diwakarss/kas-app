import React, { useState } from 'react';
import { View, Text, TextInput, Switch, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../core/theme/tokens';
import type { Field } from '../core/types/spec';

interface FieldRendererProps {
  field: Field;
  value: any;
  onChange: (value: any) => void;
  stepConfig?: { prefix?: string; suffix?: string; placeholder?: string; keyboard?: string };
}

export default function FieldRenderer({ field, value, onChange, stepConfig }: FieldRendererProps) {
  const prefix = stepConfig?.prefix || field.prefix;
  const suffix = stepConfig?.suffix || field.suffix;
  const placeholder = stepConfig?.placeholder || field.placeholder || '';

  switch (field.type) {
    case 'text':
    case 'phone':
    case 'email':
      return (
        <TextInputField
          value={value ?? ''}
          onChange={onChange}
          keyboardType={field.type === 'phone' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default'}
          placeholder={placeholder}
          prefix={prefix}
          suffix={suffix}
        />
      );
    case 'number':
    case 'currency':
    case 'duration':
      return (
        <TextInputField
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(v: string) => { const num = parseFloat(v); onChange(isNaN(num) ? v : num); }}
          keyboardType="number-pad"
          placeholder={placeholder}
          prefix={prefix || (field.type === 'currency' ? field.prefix : undefined)}
          suffix={suffix || (field.type === 'duration' ? 'minutes' : undefined)}
        />
      );
    case 'note':
      return (
        <TextInputField value={value ?? ''} onChange={onChange} keyboardType="default" placeholder={placeholder} multiline />
      );
    case 'choice':
      return <ChoicePicker options={field.options || []} allowCustom={field.allow_custom || false} value={value} onChange={onChange} />;
    case 'toggle':
      return (
        <View className="items-start py-2">
          <Switch value={!!value} onValueChange={onChange} trackColor={{ false: colors.mist, true: colors.bloom }} thumbColor={colors.dawn} />
        </View>
      );
    case 'date':
      return <DatePickerField value={value} onChange={onChange} mode="date" />;
    case 'datetime':
      return <DatePickerField value={value} onChange={onChange} mode="datetime" />;
    case 'time':
      return <DatePickerField value={value} onChange={onChange} mode="time" />;
    case 'image':
      return (
        <View className="py-4">
          <Text className="font-inter text-sm text-mist italic">Image upload coming in a future update</Text>
        </View>
      );
    default:
      return <TextInputField value={value ?? ''} onChange={onChange} keyboardType="default" placeholder={placeholder} />;
  }
}

interface TextInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  keyboardType: 'default' | 'number-pad' | 'phone-pad' | 'email-address';
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  multiline?: boolean;
}

function TextInputField({ value, onChange, keyboardType, placeholder, prefix, suffix, multiline }: TextInputFieldProps) {
  return (
    <View className="flex-row items-center">
      {prefix ? <Text className="font-inter text-mist mr-2" style={{ fontSize: 20 }}>{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.mist}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        style={{
          flex: 1, fontSize: 24, fontFamily: 'Inter_400Regular',
          borderBottomWidth: 2, borderBottomColor: colors.mist + '40',
          paddingVertical: 12, color: colors.clay,
          ...(multiline ? { minHeight: 120, textAlignVertical: 'top' as const } : {}),
        }}
        autoFocus
      />
      {suffix ? <Text className="font-inter text-mist ml-2" style={{ fontSize: 16 }}>{suffix}</Text> : null}
    </View>
  );
}

interface ChoicePickerProps {
  options: string[];
  allowCustom: boolean;
  value: any;
  onChange: (value: string) => void;
}

function ChoicePicker({ options, allowCustom, value, onChange }: ChoicePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  return (
    <View>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {options.map(opt => (
          <Pressable
            key={opt}
            onPress={() => { onChange(opt); setShowCustom(false); }}
            className="rounded-3xl"
            style={{
              paddingHorizontal: 20, paddingVertical: 12,
              backgroundColor: value === opt ? colors.ember : colors.dawn,
              borderWidth: 1.5, borderColor: value === opt ? colors.ember : colors.mist + '50',
            }}
          >
            <Text className="font-inter-medium" style={{ color: value === opt ? colors.dawn : colors.clay }}>
              {opt}
            </Text>
          </Pressable>
        ))}
        {allowCustom && (
          <Pressable
            onPress={() => setShowCustom(true)}
            className="rounded-3xl"
            style={{ paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.mist + '50', borderStyle: 'dashed' }}
          >
            <Text className="font-inter-medium text-stream">Other</Text>
          </Pressable>
        )}
      </View>
      {showCustom && (
        <TextInput
          value={customValue}
          onChangeText={(v) => { setCustomValue(v); onChange(v); }}
          placeholder="Enter custom value"
          placeholderTextColor={colors.mist}
          style={{
            fontSize: 18, fontFamily: 'Inter_400Regular',
            borderBottomWidth: 2, borderBottomColor: colors.stream,
            paddingVertical: 12, marginTop: 16, color: colors.clay,
          }}
          autoFocus
        />
      )}
    </View>
  );
}

interface DatePickerFieldProps {
  value: any;
  onChange: (value: string) => void;
  mode: 'date' | 'time' | 'datetime';
}

function DatePickerField({ value, onChange, mode }: DatePickerFieldProps) {
  // Web fallback: use raw HTML <input> since RN TextInput ignores type prop
  if (Platform.OS === 'web') {
    const webInputStyle = {
      fontSize: 24, fontFamily: 'Inter_400Regular',
      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
      borderBottom: `2px solid ${colors.mist}40`,
      paddingTop: 12, paddingBottom: 12,
      color: colors.clay, background: 'transparent',
      outline: 'none', width: '100%',
    } as any;

    // For datetime mode, render separate date + time inputs for better browser support
    if (mode === 'datetime') {
      // Parse existing ISO value into date and time parts
      const datePart = value && typeof value === 'string' && value.includes('T')
        ? value.split('T')[0]
        : (value && typeof value === 'string' && value.includes('-') ? value : '');
      const timePart = value && typeof value === 'string' && value.includes('T')
        ? value.split('T')[1]?.substring(0, 5) ?? ''
        : '';

      const handlePartChange = (part: 'date' | 'time', partValue: string) => {
        const currentDate = datePart || new Date().toISOString().split('T')[0];
        const currentTime = timePart || '09:00';
        if (part === 'date') {
          onChange(`${partValue}T${currentTime}`);
        } else {
          onChange(`${currentDate}T${partValue}`);
        }
      };

      return (
        <View>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.mist, marginBottom: 8 }}>Date</Text>
          <input
            type="date"
            value={datePart}
            onChange={(e: any) => handlePartChange('date', e.target.value)}
            placeholder="Select date"
            autoFocus
            style={{ ...webInputStyle, marginBottom: 20 }}
          />
          <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.mist, marginBottom: 8 }}>Time</Text>
          <input
            type="time"
            value={timePart}
            onChange={(e: any) => handlePartChange('time', e.target.value)}
            placeholder="Select time"
            style={webInputStyle}
          />
        </View>
      );
    }

    const inputType = mode === 'time' ? 'time' : 'date';
    return (
      <View>
        <input
          type={inputType}
          value={value ?? ''}
          onChange={(e: any) => onChange(e.target.value)}
          placeholder={`Select ${mode}`}
          autoFocus
          style={webInputStyle}
        />
      </View>
    );
  }

  const [show, setShow] = useState(Platform.OS === 'ios');
  const dateValue = value ? new Date(value) : new Date();

  const handleChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      if (mode === 'date') {
        onChange(selectedDate.toISOString().split('T')[0]);
      } else if (mode === 'time') {
        const h = String(selectedDate.getHours()).padStart(2, '0');
        const m = String(selectedDate.getMinutes()).padStart(2, '0');
        onChange(`${h}:${m}`);
      } else {
        onChange(selectedDate.toISOString());
      }
    }
  };

  return (
    <View>
      {Platform.OS === 'android' && !show && (
        <Pressable
          onPress={() => setShow(true)}
          style={{ paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: colors.mist + '40' }}
        >
          <Text className="font-inter" style={{ fontSize: 24, color: value ? colors.clay : colors.mist }}>
            {value || `Select ${mode}`}
          </Text>
        </Pressable>
      )}
      {show && (
        <DateTimePicker
          value={dateValue}
          mode={mode === 'datetime' ? 'datetime' : mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          accentColor={colors.stream}
        />
      )}
    </View>
  );
}
