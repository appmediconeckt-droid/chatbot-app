import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { DOCTOR } from '../../theme/palette';

const CounselorGradientButton = ({
  children,
  style,
  contentStyle,
  disabled = false,
  activeOpacity = 0.85,
  ...touchableProps
}) => (
  <TouchableOpacity
    {...touchableProps}
    activeOpacity={activeOpacity}
    disabled={disabled}
    style={[styles.touchable, style, disabled && styles.disabled]}
  >
    <LinearGradient
      colors={[DOCTOR.gradientFrom, DOCTOR.gradientTo]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFillObject}
    />
    <View style={[styles.content, contentStyle]}>{children}</View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  touchable: { overflow: 'hidden' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: { opacity: 0.5 },
});

export default CounselorGradientButton;
