import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { APP_VERSION_CODE, APP_VERSION_LABEL } from '../../constants/appInfo';

export default function AppVersionFooter() {
  return (
    <Text style={styles.label} testID="app-version">
      {APP_VERSION_LABEL} (Build {APP_VERSION_CODE})
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#667085',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
});
