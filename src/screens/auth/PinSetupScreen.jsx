import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLockScreen, { PIN_STORAGE_KEY } from './AppLockScreen';

/**
 * Two-step PIN creation screen.
 * Step 1 (setup)   — user enters new PIN
 * Step 2 (confirm) — user re-enters PIN; if they match it is saved
 *
 * Optional route params:
 *   forced      — true when the app requires a PIN before continuing (a fresh
 *                 device has no PIN, since it lives in device-local storage).
 *                 In this mode the screen cannot be dismissed.
 *   destination — where to go once the PIN is saved (forced mode only).
 *
 * Navigate here via: navigation.navigate('PinSetup', { forced: false })
 */
const PinSetupScreen = ({ navigation, route }) => {
  const forced = route?.params?.forced === true;
  const destination = route?.params?.destination;
  const destinationParams = route?.params?.destinationParams;
  const [step, setStep]       = useState('setup');
  const [firstPin, setFirstPin] = useState('');

  const handleSetupDone = (pin) => {
    setFirstPin(pin);
    setStep('confirm');
  };

  const handleConfirmDone = () => {
    if (forced) {
      // Enter the app; replace so PIN setup isn't in the back stack.
      // destinationParams keeps the onward flow intact (e.g. LocationGate
      // still needs to know which dashboard to open).
      navigation.replace(destination || 'UserDashboard', destinationParams);
    } else {
      navigation.goBack();
    }
  };

  const handleCancel = async () => {
    if (step === 'confirm') {
      // Back to first step, don't save anything
      setStep('setup');
      setFirstPin('');
      return;
    }
    // A forced setup can't be skipped — the app requires a PIN on this device.
    if (forced) return;
    navigation.goBack();
  };

  return (
    <AppLockScreen
      key={step}             // remounts the component on step change → fresh animation
      mode={step}
      confirmPin={firstPin}
      forced={forced}
      onSuccess={step === 'setup' ? handleSetupDone : handleConfirmDone}
      onCancel={handleCancel}
    />
  );
};

export default PinSetupScreen;
