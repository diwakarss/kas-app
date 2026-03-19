// Jest mock for react-native — tests run in Node, not React Native
module.exports = {
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
};
