import React from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { useSearch } from '../hooks/useSearch';
import SearchBar from '../components/SearchBar';
import SectionHeader from '../components/SectionHeader';
import { colors } from '../core/theme/tokens';

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ visible, onClose }: SearchOverlayProps) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const search = useSearch();

  const handleResultPress = (entityType: string, entityId: number) => {
    search.clear();
    onClose();
    navigation.navigate('Story', { entityType, entityId });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView className="flex-1 bg-dawn">
        <View className="flex-row items-center px-5 py-2">
          <Pressable
            onPress={() => { search.clear(); onClose(); }}
            accessibilityLabel="Close search"
            accessibilityRole="button"
          >
            <Text className="font-inter-medium text-base text-stream">{'\u2715'} Close</Text>
          </Pressable>
        </View>

        <View className="my-3">
          <SearchBar
            value={search.query}
            onChangeText={search.setQuery}
            onClear={search.clear}
            autoFocus
          />
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {search.groups.map(group => (
            <View key={group.entityType} className="mb-4">
              <SectionHeader
                title={`${group.icon} ${group.displayName}`}
                count={group.results.length}
              />
              {group.results.map(result => (
                <Pressable
                  key={`${result.entityType}-${result.id}`}
                  onPress={() => handleResultPress(result.entityType, result.id)}
                  className="px-5 py-3"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.mist + '15' }}
                  accessibilityLabel={`${result.display}, ${group.displayName}`}
                  accessibilityRole="button"
                  accessibilityHint="Tap to view details"
                >
                  <Text className="font-inter text-sm text-clay">{result.display}</Text>
                </Pressable>
              ))}
            </View>
          ))}

          {search.isEmpty && (
            <View className="items-center py-12">
              <Text className="font-inter text-sm text-mist">
                No results for "{search.query}"
              </Text>
            </View>
          )}

          {!search.query && (
            <View className="items-center py-12">
              <Text className="font-inter text-sm text-mist">
                Search students, classes, payments...
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
