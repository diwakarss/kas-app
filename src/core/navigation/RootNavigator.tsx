import React from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import type { RootStackParamList } from './types';
import AnchorScreen from '../../screens/AnchorScreen';
import StoryScreen from '../../screens/StoryScreen';
import AddFlowScreen from '../../screens/AddFlowScreen';
import CalendarScreen from '../../screens/CalendarScreen';

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Anchor"
      screenOptions={{
        headerShown: false,
        ...TransitionPresets.SlideFromRightIOS,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyle: { flex: 1 },
      }}
    >
      <Stack.Screen name="Anchor" component={AnchorScreen} />
      <Stack.Screen name="Story" component={StoryScreen} />
      <Stack.Screen name="AddFlow" component={AddFlowScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
    </Stack.Navigator>
  );
}
