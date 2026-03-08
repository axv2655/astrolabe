const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// 1. Tell Metro to bundle .tflite files
config.resolver.assetExts.push('tflite');

// 2. Pass the modified config into NativeWind
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });