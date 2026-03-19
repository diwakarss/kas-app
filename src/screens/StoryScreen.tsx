import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { useSpec } from '../core/context/SpecContext';
import { useStoryData } from '../hooks/useStoryData';
import type { TimelineEventData } from '../hooks/useStoryData';
import StatsCard from '../components/StatsCard';
import TimelineEvent from '../components/TimelineEvent';
import SectionHeader from '../components/SectionHeader';
import ComingUpCard from '../components/ComingUpCard';
import WarningBadge from '../components/WarningBadge';
import FloatingActions from '../components/FloatingActions';
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

  const renderEvent = useCallback(({ item: event, index }: { item: TimelineEventData; index: number }) => {
    const isLast = storyData ? index === storyData.events.length - 1 : false;
    return (
      <TimelineEvent
        display={event.display}
        iconColor={event.iconColor}
        sortDate={event.sortDate}
        isLast={isLast}
      />
    );
  }, [storyData?.events.length]);

  const keyExtractor = useCallback((item: TimelineEventData, index: number) => {
    return `${item.sourceEntity}-${item.id}-${index}`;
  }, []);

  const ListHeader = useMemo(() => {
    if (!storyData) return null;
    return (
      <>
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

        <View className="px-5 mb-1">
          <Text style={{ fontSize: 28 }}>{entityIcon}</Text>
          <Text className="font-inter-semibold text-clay mt-1" style={{ fontSize: 24 }}>
            {entityName}
          </Text>
          <Text className="font-inter text-sm text-mist mt-0.5">
            {storyData.entityDef.display_name}
          </Text>
        </View>

        <View className="px-5 mb-4">
          <Text className="font-inter text-sm text-mist">{storyData.context}</Text>
        </View>

        {storyData.statsCard.length > 0 && <StatsCard items={storyData.statsCard} />}

        {storyData.warnings.length > 0 && (
          <View className="px-5 mb-3">
            {storyData.warnings.map((w, i) => (
              <View key={i} className="mb-1.5">
                <WarningBadge warning={w} />
              </View>
            ))}
          </View>
        )}

        {storyData.comingUp.length > 0 && (
          <View className="mb-4">
            <SectionHeader title="Coming Up" count={storyData.comingUp.length} />
            {storyData.comingUp.map(item => (
              <ComingUpCard key={item.id} display={item.display} sortDate={item.sortDate} />
            ))}
          </View>
        )}

        {storyData.events.length > 0 && (
          <SectionHeader title="Story" count={storyData.totalLoaded} />
        )}
      </>
    );
  }, [storyData, entityName, entityIcon, navigation]);

  const ListFooter = useMemo(() => {
    if (!storyData) return null;
    return (
      <>
        {storyData.hasMore && (
          <Pressable
            onPress={() => setPage(p => p + 1)}
            className="items-center py-4"
          >
            <Text className="font-inter-medium text-sm text-stream">Load more</Text>
          </Pressable>
        )}
        <View className="px-5 py-6 items-center">
          <Text className="font-inter text-sm text-mist italic">{storyData.origin}</Text>
        </View>
      </>
    );
  }, [storyData?.hasMore, storyData?.origin]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.ember} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !storyData) {
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
      <FlatList
        data={storyData.events}
        renderItem={renderEvent}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <FloatingActions />
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
