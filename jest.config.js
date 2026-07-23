module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$':
      '<rootDir>/node_modules/react-native/jest/assetFileTransformer.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@stream-io|react-native-linear-gradient|react-native-vector-icons|@react-native-vector-icons|react-native-image-picker|react-native-permissions|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-svg|react-native-fs|react-native-sound|react-native-tts|react-native-razorpay|react-native-biometrics|react-native-geolocation-service|@react-native-google-signin|@react-native-picker|@react-native-community|@react-native-documents)/)',
  ],
};
