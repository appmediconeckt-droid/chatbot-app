import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const AiMicButton = ({
  isListening,
  isLoading,
  onPress,
  disabled,
  style,
}) => {
  const isActive = isListening || isLoading;
  const iconColor = isActive ? '#ef4444' : '#006B2C';
  const bgColor = isActive ? '#fecaca' : '#f0fdf4';

  return (
    <TouchableOpacity
      style={[
        styles.micButton,
        { backgroundColor: bgColor },
        style,
        disabled && styles.micButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityLabel={isListening ? 'Stop listening' : 'Start listening with microphone'}
      accessibilityRole="button"
      accessibilityState={{ disabled, checked: isListening }}
    >
      {isLoading ? (
        <ActivityIndicator size={18} color={iconColor} />
      ) : (
        <MaterialIcons
          name={isListening ? 'mic' : 'mic-none'}
          size={18}
          color={iconColor}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
});

export default AiMicButton;
