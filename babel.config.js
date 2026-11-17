module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already adds the Reanimated 4 / worklets plugin, so the NativeWind
    // babel plugin is added on its own instead of through `nativewind/babel` (which would add it twice).
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: [require('react-native-css-interop/dist/babel-plugin').default],
  };
};
