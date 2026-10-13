// Ported from MediconecktApp's src/doctor/dashboard/components/QueueTabs.tsx.
// Pending / In Progress / Next / Completed — the web dashboard's queues
// (Next = patients moved aside with "Next" in the consent form), with a live
// count per tab. Scrolls sideways so no label gets cut on narrow phones.
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
      {tabs.map((tab) => {
        const on = active === tab;
        return (
          <Pressable key={tab} onPress={() => onChange(tab)} style={[styles.tab, on && styles.activeTab]}>
            <Text style={[styles.text, on && styles.activeText]} numberOfLines={1}>
              {tab}
            </Text>
            {counts[tab] !== undefined && (
              <View style={[styles.badge, on && styles.activeBadge]}>
                <Text translate={false} style={[styles.badgeText, on && styles.activeBadgeText]}>
                  {counts[tab]}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = createDoctorStyles({
  scroll: { flexGrow: 0, marginBottom: 14 },
  tabs: { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingRight: 4 },
  tab: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 8, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE7E5' },
  activeTab: { backgroundColor: colors.blue, borderColor: colors.blue },
  text: { ...typography.caption, fontSize: 13.5, color: '#475569' },
  activeText: { color: '#FFFFFF', fontWeight: '800' },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F6' },
  activeBadge: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { ...typography.caption, fontSize: 11.5, color: '#475569' },
  activeBadgeText: { color: '#FFFFFF' },
});
