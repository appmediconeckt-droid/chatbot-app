import React from 'react';
import { Alert, View } from 'react-native';
import PasswordForm from './PasswordForm';
import authService from '../../services/authService';

const SetPassword = ({ navigation }) => {
  const handleSubmit = async ({ password }) => {
    const response = await authService.setPassword({ password });
    Alert.alert(
      'Password Saved',
      response?.data?.message || 'Password set successfully',
      [{ text: 'OK', onPress: () => navigation?.goBack?.() }],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <PasswordForm mode="set" onSubmit={handleSubmit} />
    </View>
  );
};

export default SetPassword;
