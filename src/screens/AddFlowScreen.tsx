import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { useAddFlow } from '../hooks/useAddFlow';
import FieldRenderer from '../components/FieldRenderer';
import EntityPicker from '../components/EntityPicker';
import StepProgress from '../components/StepProgress';
import { colors } from '../core/theme/tokens';

type AddFlowRouteProp = RouteProp<RootStackParamList, 'AddFlow'>;

export default function AddFlowScreen() {
  const route = useRoute<AddFlowRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { entityType, preFill } = route.params;
  const flow = useAddFlow(entityType, preFill);
  const [afterAddState, setAfterAddState] = useState<{ id: number } | null>(null);

  if (!flow.entityDef || flow.steps.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter text-sm text-mist">No add flow configured for {entityType}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // After-add states (suggest another entity or navigate to story)
  if (afterAddState && flow.afterAdd) {
    const afterAdd = flow.afterAdd;

    if (afterAdd.action === 'suggest') {
      return (
        <SafeAreaView className="flex-1 bg-dawn">
          <View className="flex-1 justify-center items-center px-8">
            <Text style={{ fontSize: 48 }} className="mb-4">{flow.entityDef.icon}</Text>
            <Text className="font-inter-semibold text-clay text-center mb-6" style={{ fontSize: 20 }}>
              {flow.entityDef.display_name} added!
            </Text>
            <Pressable
              onPress={() => {
                const preFillData: Record<string, any> = {};
                if (afterAdd.pre_fill) {
                  for (const [key, val] of Object.entries(afterAdd.pre_fill)) {
                    preFillData[key] = val === '{id}' ? afterAddState.id : val;
                  }
                }
                navigation.replace('AddFlow', { entityType: afterAdd.target!, preFill: preFillData });
              }}
              className="rounded-xl mb-3"
              style={{ backgroundColor: colors.stream, paddingHorizontal: 24, paddingVertical: 14 }}
            >
              <Text className="font-inter-medium text-base" style={{ color: colors.dawn }}>{afterAdd.text}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()}>
              <Text className="font-inter-medium text-sm text-stream">Skip for now</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    if (afterAdd.action === 'navigate' && afterAdd.target) {
      const targetFK = flow.entityDef.relationships.find(
        r => r.type === 'belongs_to' && r.target === afterAdd.target
      )?.foreign_key;
      const targetId = targetFK ? flow.values[targetFK] || preFill?.[targetFK] : afterAddState.id;

      return (
        <SafeAreaView className="flex-1 bg-dawn">
          <View className="flex-1 justify-center items-center px-8">
            <Text style={{ fontSize: 48 }} className="mb-4">{flow.entityDef.icon}</Text>
            <Text className="font-inter-semibold text-clay text-center mb-6" style={{ fontSize: 20 }}>
              {flow.entityDef.display_name} added!
            </Text>
            <Pressable
              onPress={() => navigation.replace('Story', { entityType: afterAdd.target!, entityId: targetId })}
              className="rounded-xl mb-3"
              style={{ backgroundColor: colors.stream, paddingHorizontal: 24, paddingVertical: 14 }}
            >
              <Text className="font-inter-medium text-base" style={{ color: colors.dawn }}>
                {afterAdd.text || `View ${afterAdd.target}`}
              </Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()}>
              <Text className="font-inter-medium text-sm text-stream">Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    navigation.goBack();
    return null;
  }

  const handleNext = () => {
    if (flow.isLastStep) {
      const id = flow.submit();
      if (id !== null) {
        if (flow.afterAdd && flow.afterAdd.action !== 'none') {
          setAfterAddState({ id });
        } else {
          navigation.goBack();
        }
      }
    } else {
      flow.next();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-dawn">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-5 py-2">
          <Pressable onPress={() => flow.currentStep > 0 ? flow.back() : navigation.goBack()}>
            <Text className="font-inter-medium text-base text-stream">
              {flow.currentStep > 0 ? '\u2190 Back' : '\u2715 Cancel'}
            </Text>
          </Pressable>
        </View>

        <StepProgress current={flow.currentStep} total={flow.totalSteps} />

        {flow.contextSummary ? (
          <View className="px-5 pb-2">
            <Text className="font-inter text-sm text-mist">{flow.contextSummary}</Text>
          </View>
        ) : null}

        <View className="px-5 py-4">
          <Text className="font-inter-semibold text-clay" style={{ fontSize: 28 }}>
            {flow.currentStepDef?.prompt}
          </Text>
        </View>

        <View className="px-5 flex-1">
          {flow.fkTarget ? (
            <EntityPicker
              options={flow.fkOptions}
              entityDisplayName={flow.fkTarget}
              value={flow.currentValue ?? null}
              onChange={flow.setValue}
            />
          ) : flow.fieldDef ? (
            <FieldRenderer
              field={flow.fieldDef}
              value={flow.currentValue}
              onChange={flow.setValue}
              stepConfig={flow.currentStepDef || undefined}
            />
          ) : null}
        </View>

        <View className="px-5 pb-6">
          {flow.currentStepDef && !flow.currentStepDef.required && (
            <Pressable
              onPress={flow.isLastStep ? handleNext : flow.skip}
              className="items-center py-3 mb-2"
            >
              <Text className="font-inter-medium text-sm" style={{ color: colors.mist }}>
                {flow.currentStepDef.skip_text || 'skip'}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            disabled={!flow.canAdvance}
            className="rounded-xl items-center"
            style={{
              backgroundColor: flow.canAdvance ? colors.stream : colors.mist + '50',
              paddingVertical: 16,
              opacity: flow.canAdvance ? 1 : 0.6,
            }}
            accessibilityLabel={flow.isLastStep ? 'Done, save entry' : 'Next step'}
            accessibilityRole="button"
            accessibilityState={{ disabled: !flow.canAdvance }}
          >
            <Text
              className="font-inter-medium text-base"
              style={{ color: flow.canAdvance ? colors.dawn : colors.clay + '80' }}
            >
              {flow.isLastStep ? 'Done' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
