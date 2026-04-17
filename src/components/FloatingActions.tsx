import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { colors } from '../core/theme/tokens';
import AddMenu from './AddMenu';
import SearchOverlay from '../screens/SearchOverlay';
import ChatOverlay from '../screens/ChatOverlay';

export default function FloatingActions() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Build context for AddMenu
  const routeName = route.name;
  const routeParams = (route.params || {}) as Record<string, any>;

  return (
    <>
      <View
        className="absolute bottom-0 left-0 right-0 flex-row items-center justify-around px-4"
        style={{
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.dawn + 'E6',
          borderTopWidth: 1,
          borderTopColor: colors.mist + '20',
        }}
      >
        <Pressable
          onPress={() => setShowSearch(true)}
          accessibilityRole="button"
          accessibilityLabel="Search"
          className="items-center justify-center p-3"
        >
          <Text style={{ fontSize: 22 }}>{'\uD83D\uDD0D'}</Text>
          <Text className="font-inter text-xs text-mist mt-0.5">Search</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Calendar')}
          accessibilityRole="button"
          accessibilityLabel="Calendar"
          className="items-center justify-center p-3"
        >
          <Text style={{ fontSize: 22 }}>{'\uD83D\uDCC5'}</Text>
          <Text className="font-inter text-xs text-mist mt-0.5">Calendar</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowAddMenu(true)}
          accessibilityRole="button"
          accessibilityLabel="Add new"
          className="items-center justify-center"
          style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: colors.stream,
          }}
        >
          <Text style={{ fontSize: 24, color: colors.dawn, fontWeight: '300' }}>+</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowChat(true)}
          accessibilityRole="button"
          accessibilityLabel="Chat"
          className="items-center justify-center p-3"
        >
          <Text style={{ fontSize: 22 }}>{'\uD83D\uDCAC'}</Text>
          <Text className="font-inter text-xs text-mist mt-0.5">Chat</Text>
        </Pressable>
      </View>

      <AddMenu
        visible={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        routeName={routeName}
        routeParams={routeParams}
      />

      <SearchOverlay
        visible={showSearch}
        onClose={() => setShowSearch(false)}
      />

      <ChatOverlay
        visible={showChat}
        onClose={() => setShowChat(false)}
      />
    </>
  );
}
