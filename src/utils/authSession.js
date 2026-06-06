import AsyncStorage from '@react-native-async-storage/async-storage';

export const clearStoredSession = async () => {
  await AsyncStorage.multiRemove([
    'accessToken', 'token', 'refreshToken',
    'userData', 'userId', 'userRole',
    'counsellorId', 'counselorId',
  ]);
};

export const resetToRoleSelector = (navigation) => {
  navigation?.replace?.('RoleSelector');
};
