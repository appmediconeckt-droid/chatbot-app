import React from 'react';
import { Alert, View } from 'react-native';
import PasswordForm from './PasswordForm';
import authService from '../../services/authService';

const ChangePassword = ({ navigation }) => {
  const handleSubmit = async ({ oldPassword, password }) => {
    const response = await authService.changePassword({ oldPassword, newPassword: password });
    Alert.alert(
      'Password Changed',
      response?.data?.message || 'Password changed successfully. Please log in again.',
      [{ text: 'OK', onPress: () => navigation?.goBack?.() }],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <PasswordForm mode="change" onSubmit={handleSubmit} />
    </View>
  );
};

export default ChangePassword;
