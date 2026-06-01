module.exports = {
  preset: '@react-native/jest-preset',
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/mocks/'],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/__tests__/mocks/assetsMock.js',
  },
};
