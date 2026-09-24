// Ported from MediconecktApp's src/doctor/dashboard/components/QueueTabs.tsx.
// Pending / In Progress / Completed — same three queues as the web dashboard,
// with a live count per tab.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, typography, createDoctorStyles } from '../theme';

const tabs = ['Pending', 'In Progress', 'Completed'];

export default function QueueTabs({ active, onChange, counts = {} }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => (
        <Pressable key={tab} onPress={() => onChange(tab)} style={[styles.tab, active === tab && styles.activeTab]}>
          <Text style={[styles.text, active === tab && styles.activeText]}>
            {tab}{counts[tab] !== undefined ? ` (${counts[tab]})` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = createDoctorStyles({
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#AEB4BE', marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.blue },
  text: { ...typography.caption, fontSize: 14, color: '#606775' },
  activeText: { color: colors.blue, fontWeight: '800' },
});
