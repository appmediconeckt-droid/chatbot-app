module.exports = {
  assets: ['./assets'],
  dependencies: {
    'react-native-incall-manager': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-incall-manager/android',
          packageImportPath: 'import com.zxcpoiu.incallmanager.InCallManagerPackage;',
          packageInstance: 'new InCallManagerPackage()',
        },
      },
    },
  },
};
