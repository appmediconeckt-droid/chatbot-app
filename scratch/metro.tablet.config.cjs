const path = require('path');
const base = require('../metro.config');
const root = path.resolve(__dirname, '..');
module.exports = {
  ...base,
  resolver: {
    ...base.resolver,
    resolveRequest(context, moduleName, platform) {
      if (context.originModulePath === path.join(root, 'index.js') && moduleName === './App') {
        return { type: 'sourceFile', filePath: path.join(root, 'test-artifacts/tablet-responsive/PreviewApp.jsx') };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};
