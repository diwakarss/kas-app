// Jest mock for react-native — tests run in Node, not React Native
const React = require('react');

const createMockComponent = (name) => {
  const component = ({ children, ...props }) => React.createElement(name, props, children);
  component.displayName = name;
  return component;
};

module.exports = {
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
  },
  View: createMockComponent('View'),
  Text: createMockComponent('Text'),
  TouchableOpacity: createMockComponent('TouchableOpacity'),
  ScrollView: createMockComponent('ScrollView'),
  FlatList: createMockComponent('FlatList'),
  TextInput: createMockComponent('TextInput'),
  Pressable: createMockComponent('Pressable'),
  Image: createMockComponent('Image'),
  Animated: {
    View: createMockComponent('Animated.View'),
    Text: createMockComponent('Animated.Text'),
    Value: class { constructor(v) { this._value = v; } },
    timing: () => ({ start: () => {} }),
    spring: () => ({ start: () => {} }),
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  useWindowDimensions: () => ({ width: 375, height: 812 }),
};
