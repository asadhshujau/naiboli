// Renders the native scene port offscreen with CanvasKit (see README.md in this folder).
module.exports = {
  rootDir: '../..',
  preset: 'jest-expo',
  testEnvironment: '@shopify/react-native-skia/jestEnv.js',
  setupFiles: ['@shopify/react-native-skia/jestSetup.js'],
  testMatch: ['<rootDir>/scripts/scene-compare/*.render.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/react-native-skia|react-native-svg)',
  ],
};
