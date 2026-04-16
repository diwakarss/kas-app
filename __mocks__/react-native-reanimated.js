// Jest mock for react-native-reanimated
const React = require('react');

const createMockComponent = (name) => {
  const component = ({ children, ...props }) => React.createElement(name, props, children);
  component.displayName = name;
  return component;
};

module.exports = {
  default: {
    View: createMockComponent('Animated.View'),
    Text: createMockComponent('Animated.Text'),
    ScrollView: createMockComponent('Animated.ScrollView'),
    FlatList: createMockComponent('Animated.FlatList'),
    createAnimatedComponent: (comp) => comp,
  },
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => fn(),
  withSpring: (v) => v,
  withTiming: (v) => v,
  withDelay: (_, v) => v,
  interpolate: (v) => v,
  Extrapolate: { CLAMP: 'clamp' },
  FadeIn: { duration: () => ({ delay: () => ({}) }) },
  FadeOut: { duration: () => ({}) },
  SlideInRight: { duration: () => ({}) },
  Layout: { duration: () => ({}) },
};
