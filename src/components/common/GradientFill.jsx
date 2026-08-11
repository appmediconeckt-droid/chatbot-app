import React from 'react';
import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { DOCTOR, PATIENT } from '../../theme/palette';

/**
 * Drop-in brand gradient for elements that already have a flat backgroundColor.
 *
 * Renders as an absolute fill, so converting a flat badge/pill/header is a
 * one-line change instead of wrapping the element and re-parenting its children:
 *
 *   // style: drop `backgroundColor`, add `overflow: 'hidden'`
 *   <View style={s.badge}>
 *     <GradientFill />
 *     <Text>...</Text>
 *   </View>
 *
 * The parent needs `overflow: 'hidden'` for the fill to respect its radius, and
 * the siblings must come *after* this so they paint on top.
 *
 * Same colours and direction as the wallet / earnings balance card.
 */
const GradientFill = ({ role = 'counselor', style }) => {
  const p = role === 'user' || role === 'patient' ? PATIENT : DOCTOR;
  return (
    <LinearGradient
      colors={[p.gradientFrom, p.gradientTo]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[StyleSheet.absoluteFillObject, style]}
      pointerEvents="none"
    />
  );
};

export default GradientFill;
