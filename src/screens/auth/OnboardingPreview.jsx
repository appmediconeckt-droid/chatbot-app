import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import UserOnboarding from './UserOnboarding';
import CounselorOnboarding from './CounselorOnboarding';

const OnboardingPreview = () => {
  const navigation = useNavigation();
  const [phase, setPhase] = useState('user');

  const handlePreviewComplete = () => {
    if (phase === 'user') {
      setPhase('counselor');
      return;
    }

    navigation.replace('RoleSelector');
  };

  return (
    <View style={styles.container}>
      {phase === 'user' ? (
        <UserOnboarding previewMode onPreviewComplete={handlePreviewComplete} navigation={navigation} />
      ) : (
        <CounselorOnboarding previewMode onPreviewComplete={handlePreviewComplete} navigation={navigation} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default OnboardingPreview;