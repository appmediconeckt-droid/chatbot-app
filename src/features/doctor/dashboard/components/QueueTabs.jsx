// Ported from MediconecktApp's src/doctor/dashboard/components/QueueTabs.tsx.
// Pending / In Progress / Next / Completed — the web dashboard's queues
// (Next = patients moved aside with "Next" in the consent form), with a live
// count per tab. Scrolls sideways so no label gets cut on narrow phones.
import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import Text from '../../../../components/TranslatedText';
import { colors, typography, createDoctorStyles } from '../theme';

// Cancelled = not seen before their session ended (no-show) or cancelled.
const tabs = ['Pending', 'In Progress', 'Next', 'Completed', 'Cancelled'];

export default function QueueTabs({ active, onChange, counts = {} }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.tabs}
    >
      {tabs.map((tab) => (
        <Pressable key={tab} onPress={() => onChange(tab)} style={[styles.tab, active === tab && styles.activeTab]}>
          <Text style={[styles.text, active === tab && styles.activeText]} numberOfLines={1}>
            {tab}{counts[tab] !== undefined ? ` (${counts[tab]})` : ''}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = createDoctorStyles({
  scroll: { flexGrow: 0, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#AEB4BE' },
  tabs: { height: 48, flexGrow: 1, flexDirection: 'row' },
  tab: { flexGrow: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.blue },
  text: { ...typography.caption, fontSize: 14, color: '#606775' },
  activeText: { color: colors.blue, fontWeight: '800' },
});
