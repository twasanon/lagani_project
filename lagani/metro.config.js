const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// eslint-disable-next-line no-undef
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');
const nativeWindConfig = withNativeWind(config, { input: './global.css' });

nativeWindConfig.server = {
  ...nativeWindConfig.server,
  enhanceMiddleware: (middleware) => (request, response, next) => {
    response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(request, response, next);
  },
};

module.exports = nativeWindConfig;
