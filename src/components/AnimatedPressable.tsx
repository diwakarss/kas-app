import React, { useCallback } from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface AnimatedPressableComponentProps extends PressableProps {
  children: React.ReactNode;
  scaleValue?: number;
}

export default function AnimatedPressable({
  children,
  scaleValue = 0.97,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: AnimatedPressableComponentProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback((e: any) => {
    scale.value = withSpring(scaleValue, { damping: 15, stiffness: 150 });
    onPressIn?.(e);
  }, [scaleValue, onPressIn, scale]);

  const handlePressOut = useCallback((e: any) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    onPressOut?.(e);
  }, [onPressOut, scale]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
