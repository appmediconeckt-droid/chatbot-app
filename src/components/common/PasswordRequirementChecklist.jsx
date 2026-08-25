import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from '../TranslatedText';
import { passwordCharacterRequirements } from '../../utils/passwordPolicy';

const PasswordRequirementChecklist = ({
  password,
  activeColor = '#16a34a',
  inactiveColor = '#94a3b8',
  style,
}) => {
  return (
    <View style={[styles.wrap, style]}>
      {passwordCharacterRequirements.map((requirement) => {
        const complete = requirement.test(password);
        const color = complete ? activeColor : inactiveColor;

        return (
          <View key={requirement.key} style={styles.item}>
            <View style={[styles.dot, { borderColor: color }, complete && { backgroundColor: color }]} />
            <Text style={[styles.label, { color }]}>{requirement.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingRight: 8,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    marginRight: 6,
  },
  label: {
    flexShrink: 1,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
  },
});

export default PasswordRequirementChecklist;
