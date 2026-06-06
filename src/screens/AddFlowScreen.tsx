import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../core/navigation/types";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
  ValidationProvider,
} from "@json-render/react-native";
import { useAddFlow } from "../hooks/useAddFlow";
import { buildAddFlowSpec } from "../ui/spec-builders/add-flow";
import { registry } from "../ui/registry";
import { FieldChangeProvider } from "../ui/FieldChangeContext";
import { colors } from "../core/theme/tokens";

type AddFlowRouteProp = RouteProp<RootStackParamList, "AddFlow">;

export default function AddFlowScreen() {
  const route = useRoute<AddFlowRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { entityType, preFill } = route.params;
  const flow = useAddFlow(entityType, preFill);
  const [afterAddState, setAfterAddState] = useState<{ id: number } | null>(
    null,
  );

  // ActionProvider from @json-render/react-native captures handlers via
  // useState on first mount, so later renders would hand back stale closures
  // over `flow`. Route all handler logic through a ref to always see the
  // latest flow state.
  const flowRef = useRef(flow);
  useEffect(() => {
    flowRef.current = flow;
  });

  const handleNext = useCallback(() => {
    const f = flowRef.current;
    if (f.isLastStep) {
      const id = f.submit();
      if (id !== null) {
        if (f.afterAdd && f.afterAdd.action !== "none") {
          setAfterAddState({ id });
        } else {
          navigation.goBack();
        }
      }
    } else {
      f.next();
    }
  }, [navigation]);

  const uiSpec = useMemo(() => {
    if (!flow.entityDef || flow.steps.length === 0) return null;
    return buildAddFlowSpec({
      entityDef: flow.entityDef,
      steps: flow.steps,
      currentStep: flow.currentStep,
      totalSteps: flow.totalSteps,
      currentStepDef: flow.currentStepDef,
      fieldDef: flow.fieldDef,
      currentValue: flow.currentValue,
      canAdvance: flow.canAdvance,
      isLastStep: flow.isLastStep,
      contextSummary: flow.contextSummary,
      fkTarget: flow.fkTarget,
      fkOptions: flow.fkOptions,
    });
  }, [flow]);

  const actionHandlers = useMemo(
    () => ({
      addFlowNext: async () => handleNext(),
      addFlowBack: async () => {
        const f = flowRef.current;
        if (f.currentStep > 0) {
          f.back();
        } else {
          navigation.goBack();
        }
      },
      addFlowSkip: async () => {
        const f = flowRef.current;
        if (f.isLastStep) {
          handleNext();
        } else {
          f.skip();
        }
      },
      navigate: async (params: Record<string, unknown>) => {
        navigation.navigate(params.screen as any, params as any);
      },
    }),
    [handleNext, navigation],
  );

  if (!flow.entityDef || flow.steps.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter text-sm text-mist">
            No add flow configured for {entityType}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // After-add states stay imperative — full-screen overlays with navigation
  if (afterAddState && flow.afterAdd) {
    const afterAdd = flow.afterAdd;

    if (afterAdd.action === "suggest") {
      return (
        <SafeAreaView className="flex-1 bg-dawn">
          <View className="flex-1 justify-center items-center px-8">
            <Text style={{ fontSize: 48 }} className="mb-4">
              {flow.entityDef.icon}
            </Text>
            <Text
              className="font-inter-semibold text-clay text-center mb-6"
              style={{ fontSize: 20 }}
            >
              {flow.entityDef.display_name} added!
            </Text>
            <Pressable
              onPress={() => {
                const preFillData: Record<string, any> = {};
                if (afterAdd.pre_fill) {
                  for (const [key, val] of Object.entries(afterAdd.pre_fill)) {
                    preFillData[key] = val === "{id}" ? afterAddState.id : val;
                  }
                }
                navigation.replace("AddFlow", {
                  entityType: afterAdd.target!,
                  preFill: preFillData,
                });
              }}
              className="rounded-xl mb-3"
              style={{
                backgroundColor: colors.stream,
                paddingHorizontal: 24,
                paddingVertical: 14,
              }}
            >
              <Text
                className="font-inter-medium text-base"
                style={{ color: colors.dawn }}
              >
                {afterAdd.text}
              </Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()}>
              <Text className="font-inter-medium text-sm text-stream">
                Skip for now
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    if (afterAdd.action === "navigate" && afterAdd.target) {
      const targetFK = flow.entityDef.relationships.find(
        (r) => r.type === "belongs_to" && r.target === afterAdd.target,
      )?.foreign_key;
      const targetId = targetFK
        ? flow.values[targetFK] || preFill?.[targetFK]
        : afterAddState.id;

      return (
        <SafeAreaView className="flex-1 bg-dawn">
          <View className="flex-1 justify-center items-center px-8">
            <Text style={{ fontSize: 48 }} className="mb-4">
              {flow.entityDef.icon}
            </Text>
            <Text
              className="font-inter-semibold text-clay text-center mb-6"
              style={{ fontSize: 20 }}
            >
              {flow.entityDef.display_name} added!
            </Text>
            <Pressable
              onPress={() =>
                navigation.replace("Story", {
                  entityType: afterAdd.target!,
                  entityId: targetId,
                })
              }
              className="rounded-xl mb-3"
              style={{
                backgroundColor: colors.stream,
                paddingHorizontal: 24,
                paddingVertical: 14,
              }}
            >
              <Text
                className="font-inter-medium text-base"
                style={{ color: colors.dawn }}
              >
                {afterAdd.text || `View ${afterAdd.target}`}
              </Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()}>
              <Text className="font-inter-medium text-sm text-stream">
                Done
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    navigation.goBack();
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-dawn">
      <KeyboardAvoidingView
        className="flex-1 px-5"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StateProvider>
          <VisibilityProvider>
            <FieldChangeProvider value={flow.setValue}>
              <ActionProvider handlers={actionHandlers}>
                <ValidationProvider>
                  <Renderer spec={uiSpec} registry={registry} />
                </ValidationProvider>
              </ActionProvider>
            </FieldChangeProvider>
          </VisibilityProvider>
        </StateProvider>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
