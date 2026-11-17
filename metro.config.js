const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web ships a wa-sqlite WebAssembly build.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// expo-sqlite on web needs SharedArrayBuffer, which requires cross-origin isolation.
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhanced(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: './src/global.css' });
