import React from 'react';
import { Alert, View } from 'react-native';
import PasswordForm from './PasswordForm';
import authService from '../../services/authService';

const SetPasswordByOtp = ({ navigation }) => {
  const handleSubmit = async ({ email, password, otp }) => {
    const response = await authService.setPasswordByOtp({ email, password, otp });
    Alert.alert(
      'Password Saved',
      response?.data?.message || 'Password set successfully. Please log in.',
      [{ text: 'OK', onPress: () => navigation?.navigate?.('Login') || navigation?.goBack?.() }],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <PasswordForm mode="setByOtp" onSubmit={handleSubmit} />
    </View>
  );
};

export default SetPasswordByOtp;
