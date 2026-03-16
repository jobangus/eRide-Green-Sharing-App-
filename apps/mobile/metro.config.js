const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to watch files from the workspace root
config.watchFolders = [workspaceRoot];

// Resolve packages from both the mobile app and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Allow resolving workspace packages
config.resolver.unstable_enableSymlinks = true;

module.exports = config;