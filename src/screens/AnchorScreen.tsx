import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { useSpec } from '../core/context/SpecContext';
import { useAnchorData } from '../hooks/useAnchorData';
import type { AnchorCard } from '../hooks/useAnchorData';
import Greeting from '../components/Greeting';
import SummaryStats from '../components/SummaryStats';
import EntityCard from '../components/EntityCard';
import EmptyState from '../components/EmptyState';
import FloatingActions from '../components/FloatingActions';
import { colors } from '../core/theme/tokens';

export default function AnchorScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { spec, loading, error } = useSpec();
  const anchorData = useAnchorData();

  const belongsTo = useMemo(() => {
    if (!spec) return null;
    return spec.entities
      .find(e => e.name === spec.anchor.entity)
      ?.relationships.find(r => r.type === 'belongs_to') ?? null;
  }, [spec]);

  const renderCard = useCallback(({ item: card }: { item: AnchorCard }) => {
    const storyTarget = belongsTo?.target;
    const storyId = belongsTo ? card.rawData[belongsTo.foreign_key] : null;
    return (
      <EntityCard
        title={card.title}
        subtitle={card.subtitle}
        time={card.time}
        warningText={card.warningText}
        onPress={storyTarget && storyId
          ? () => navigation.navigate('Story', { entityType: storyTarget, entityId: storyId })
          : undefined
        }
      />
    );
  }, [belongsTo, navigation]);

  const ListHeader = useMemo(() => {
    if (!anchorData) return null;
    return (
      <>
        <Greeting greeting={anchorData.greeting} dateLabel={anchorData.dateLabel} />
        <SummaryStats stats={anchorData.stats} />
      </>
    );
  }, [anchorData?.greeting, anchorData?.dateLabel, anchorData?.stats]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.dawn }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.ember} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mist, marginTop: 12 }}>
            Loading spec...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.dawn }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18, color: colors.ember, marginBottom: 8 }}>
            Error
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.clay, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!anchorData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.dawn }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mist }}>
            No anchor data available
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dawn }}>
      <FlatList
        data={anchorData.cards}
        renderItem={renderCard}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState message={anchorData.emptyMessage} action={anchorData.emptyAction} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <FloatingActions />
    </SafeAreaView>
  );
}
