import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { ActionProvider, Renderer } from '@json-render/react-native';
import { useSpec } from '../core/context/SpecContext';
import { useStoryData } from '../hooks/useStoryData';
import { buildStorySpec } from '../ui/spec-builders/story';
import { registry } from '../ui/registry';
import ArchiveModal from '../components/ArchiveModal';
import { colors } from '../core/theme/tokens';

type StoryRouteProp = RouteProp<RootStackParamList, 'Story'>;

export default function StoryScreen() {
  const route = useRoute<StoryRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { entityType, entityId } = route.params;
  const { crud, loading, error } = useSpec();
  const [page, setPage] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  const storyData = useStoryData(entityType, entityId, page);

  const entityName = storyData?.entity.name || storyData?.entity.topic || storyData?.entityType || '';
  const entityIcon = storyData?.entityDef.icon || '';

  const uiSpec = useMemo(() => {
    if (!storyData) return null;
    return buildStorySpec(storyData);
  }, [storyData]);

  const actionHandlers = useMemo(() => ({
    navigate: async (params: Record<string, unknown>) => {
      navigation.navigate(params.screen as any, params as any);
    },
    addEntity: async (params: Record<string, unknown>) => {
      navigation.navigate('AddFlow', {
        entityType: params.entityType as string,
      });
    },
  }), [navigation]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.ember} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !storyData || !uiSpec) {
    return (
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter text-sm text-mist">
            {error || 'Entity not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-dawn">
      {/* Navigation bar — stays imperative (back + archive) */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="font-inter-medium text-base text-stream">{'\u2190'} Back</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowArchive(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="p-2"
        >
          <Text style={{ fontSize: 20, color: colors.mist }}>{'🗑'}</Text>
        </Pressable>
      </View>

      {/* Main content via json-render */}
      <ActionProvider handlers={actionHandlers}>
        <Renderer spec={uiSpec} registry={registry} />
      </ActionProvider>

      {/* Pagination — stays imperative */}
      {storyData.hasMore && (
        <Pressable
          onPress={() => setPage(p => p + 1)}
          className="items-center py-4"
        >
          <Text className="font-inter-medium text-sm text-stream">Load more</Text>
        </Pressable>
      )}

      {/* Archive modal — stays imperative */}
      <ArchiveModal
        visible={showArchive}
        entityName={entityName}
        entityIcon={entityIcon}
        eventCount={storyData.events.length}
        onConfirm={() => {
          if (crud) {
            crud.archive(entityType, entityId);
            navigation.goBack();
          }
        }}
        onCancel={() => setShowArchive(false)}
      />
    </SafeAreaView>
  );
}
