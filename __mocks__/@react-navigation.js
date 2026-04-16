// Jest mock for @react-navigation/*
module.exports = {
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
  NavigationContainer: ({ children }) => children,
};
