import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { useSpec } from '../core/context/SpecContext';
import { colors } from '../core/theme/tokens';

interface AddMenuProps {
  visible: boolean;
  onClose: () => void;
  routeName: string;
  routeParams: Record<string, any>;
}

interface AddOption {
  entityType: string;
  displayName: string;
  icon: string;
  preFill?: Record<string, any>;
}

export default function AddMenu({ visible, onClose, routeName, routeParams }: AddMenuProps) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { spec } = useSpec();

  if (!spec) return null;

  // Build context-aware options
  const options: AddOption[] = [];
  const addFlowEntities = Object.keys(spec.add_flows);

  if (routeName === 'Story' && routeParams.entityType && routeParams.entityId) {
    const storyEntity = routeParams.entityType as string;
    const storyId = routeParams.entityId as number;

    // Find entities that have a belongs_to relationship to the story entity
    for (const entityName of addFlowEntities) {
      const entityDef = spec.entities.find(e => e.name === entityName);
      if (!entityDef) continue;

      const rel = entityDef.relationships.find(
        r => r.type === 'belongs_to' && r.target === storyEntity
      );

      if (rel) {
        options.push({
          entityType: entityName,
          displayName: entityDef.display_name,
          icon: entityDef.icon,
          preFill: { [rel.foreign_key]: storyId },
        });
      }
    }

    // Also allow creating the story entity type itself if it has an add flow
    if (addFlowEntities.includes(storyEntity) && !options.find(o => o.entityType === storyEntity)) {
      const entityDef = spec.entities.find(e => e.name === storyEntity);
      if (entityDef) {
        options.push({
          entityType: storyEntity,
          displayName: entityDef.display_name,
          icon: entityDef.icon,
        });
      }
    }
  } else {
    // Default: show all entities with add flows
    for (const entityName of addFlowEntities) {
      const entityDef = spec.entities.find(e => e.name === entityName);
      if (!entityDef) continue;
      options.push({
        entityType: entityName,
        displayName: entityDef.display_name,
        icon: entityDef.icon,
      });
    }
  }

  const handleSelect = (option: AddOption) => {
    onClose();
    navigation.navigate('AddFlow', {
      entityType: option.entityType,
      preFill: option.preFill,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={onClose} accessibilityRole="none">
        <View className="flex-1" />
        <SafeAreaView edges={['bottom']}>
          <View
            className="mx-4 mb-4 rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.dawn }}
          >
            <View className="px-5 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.mist + '20' }}>
              <Text className="font-inter-semibold text-base text-clay">Add New</Text>
            </View>
            {options.map(option => (
              <Pressable
                key={option.entityType}
                onPress={() => handleSelect(option)}
                accessibilityRole="menuitem"
                className="flex-row items-center px-5 py-4"
                style={{ borderBottomWidth: 1, borderBottomColor: colors.mist + '10' }}
              >
                <Text style={{ fontSize: 24, marginRight: 12 }}>{option.icon}</Text>
                <Text className="font-inter text-base text-clay">{option.displayName}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
