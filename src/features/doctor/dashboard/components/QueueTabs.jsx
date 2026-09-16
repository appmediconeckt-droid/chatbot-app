// Ported from MediconecktApp's src/doctor/dashboard/components/QueueTabs.tsx.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const tabs = ['Pending', 'In Progress', 'Completed'];

export default function QueueTabs({ active, onChange }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => (
        <Pressable key={tab} onPress={() => onChange(tab)} style={[styles.tab, active === tab && styles.activeTab]}>
          <Text style={[styles.text, active === tab && styles.activeText]}>{tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#AEB4BE', marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.brightBlue },
  text: { fontSize: 14, fontWeight: '600', color: '#606775' },
  activeText: { color: colors.blue },
});
