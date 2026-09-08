import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const MicButton = ({
  isListening,
  onPress,
  disabled,
  style,
  size = 40,
  iconSize = 20,
  color = '#006B2C',
  activeColor = '#ef4444',
  backgroundColor = '#F0FDF4',
  activeBackgroundColor = '#FEE2E2',
}) => {
  const isActive = Boolean(isListening);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isActive ? activeBackgroundColor : backgroundColor,
        },
        style,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityLabel={isActive ? 'Stop voice typing' : 'Start voice typing'}
      accessibilityRole="button"
      accessibilityState={{ disabled, checked: isActive }}
    >
      <MaterialIcons
        name={isActive ? 'mic' : 'mic-none'}
        size={iconSize}
        color={isActive ? activeColor : color}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disabled: {
    opacity: 0.45,
  },
});

export default MicButton;
