import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLockScreen, { PIN_STORAGE_KEY } from './AppLockScreen';

/**
 * Two-step PIN creation screen.
 * Step 1 (setup)   — user enters new PIN
 * Step 2 (confirm) — user re-enters PIN; if they match it is saved
 *
 * Navigate here via: navigation.navigate('PinSetup')
 */
const PinSetupScreen = ({ navigation }) => {
  const [step, setStep]       = useState('setup');
  const [firstPin, setFirstPin] = useState('');

  const handleSetupDone = (pin) => {
    setFirstPin(pin);
    setStep('confirm');
  };

  const handleConfirmDone = () => {
    navigation.goBack();
  };

  const handleCancel = async () => {
    if (step === 'confirm') {
      // Back to first step, don't save anything
      setStep('setup');
      setFirstPin('');
    } else {
      navigation.goBack();
    }
  };

  return (
    <AppLockScreen
      key={step}             // remounts the component on step change → fresh animation
      mode={step}
      confirmPin={firstPin}
      onSuccess={step === 'setup' ? handleSetupDone : handleConfirmDone}
      onCancel={handleCancel}
    />
  );
};

export default PinSetupScreen;
