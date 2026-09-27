// Expo's default Metro config auto-detects npm workspaces (watchFolders + node_modules lookup),
// so the shared @bubo/* packages resolve from source without extra setup.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
