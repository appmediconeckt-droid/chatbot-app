import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const SUPPORT_EMAIL = 'support@mediconeckt.com';

const HelpSupport = ({ onClose, onOpenTab }) => {
  const { t } = useTranslation();

  const supportOptions = [
    {
      icon: 'forum',
      title: t('helpPage:aiWellnessChat'),
      text: t('helpPage:aiWellnessDesc'),
      action: t('helpPage:aiWellnessAction'),
      tab: 'Chat',
    },
    {
      icon: 'medical-services',
      title: t('helpPage:counselorSupport'),
      text: t('helpPage:counselorDesc'),
      action: t('helpPage:counselorAction'),
      tab: 'Counselor',
    },
    {
      icon: 'event-available',
      title: t('helpPage:appointments'),
      text: t('helpPage:appointmentsDesc'),
      action: t('helpPage:appointmentsAction'),
      tab: 'Appointment',
    },
    {
      icon: 'account-balance-wallet',
      title: t('helpPage:walletPayments'),
      text: t('helpPage:walletDesc'),
      action: t('helpPage:walletAction'),
      tab: 'Wallet',
    },
  ];

  const helpChecklist = [
    t('helpPage:checklist1'),
    t('helpPage:checklist2'),
    t('helpPage:checklist3'),
    t('helpPage:checklist4'),
  ];

  const issueGuides = [
    { title: t('helpPage:aiChatNotReply'), text: t('helpPage:aiChatNotReplyDesc') },
    { title: t('helpPage:counselorChatNotOpen'), text: t('helpPage:counselorChatNotOpenDesc') },
    { title: t('helpPage:callNotConnecting'), text: t('helpPage:callNotConnectingDesc') },
    { title: t('helpPage:walletPaymentIssue'), text: t('helpPage:walletPaymentIssueDesc') },
    { title: t('helpPage:languageWrongTitle'), text: t('helpPage:languageWrongDesc') },
  ];

  const openTab = (tab) => {
    if (typeof onOpenTab === 'function') {
      onClose?.();
      onOpenTab(tab);
    }
  };

  const emailSupport = () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=MediConeckt%20Support%20Request`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('settings:emailSupportLabel'), `Please email us at ${SUPPORT_EMAIL}`);
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('helpPage:title')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="help-outline" size={34} color="#2563eb" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t('helpPage:centerTitle')}</Text>
            <Text style={styles.heroText}>{t('helpPage:centerDesc')}</Text>
          </View>
        </View>

        <View style={styles.cardGrid}>
          {supportOptions.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.supportCard}
              activeOpacity={0.82}
              onPress={() => openTab(item.tab)}
            >
              <View style={styles.cardIcon}>
                <MaterialIcons name={item.icon} size={24} color="#2563eb" />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.text}</Text>
              <View style={styles.cardAction}>
                <Text style={styles.cardActionText}>{item.action}</Text>
                <MaterialIcons name="chevron-right" size={18} color="#2563eb" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <MaterialIcons name="person" size={20} color="#0f172a" />
            <Text style={styles.panelTitle}>{t('helpPage:beforeContact')}</Text>
          </View>
          {helpChecklist.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <MaterialIcons name="check-circle" size={18} color="#16a34a" />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('helpPage:commonIssues')}</Text>
        <View style={styles.issueList}>
          {issueGuides.map((item) => (
            <View key={item.title} style={styles.issueCard}>
              <Text style={styles.issueTitle}>{item.title}</Text>
              <Text style={styles.issueText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.supportStrip}>
          <View style={styles.stripCopy}>
            <Text style={styles.stripTitle}>{t('helpPage:needMoreHelp')}</Text>
            <Text style={styles.stripText}>{t('helpPage:needMoreHelpDesc')}</Text>
          </View>
          <View style={styles.stripActions}>
            <TouchableOpacity style={styles.stripBtn} onPress={() => openTab('profile')}>
              <Text style={styles.stripBtnText}>{t('helpPage:myProfile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stripBtn} onPress={() => openTab('settings')}>
              <Text style={styles.stripBtnText}>{t('helpPage:settings')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.stripBtn, styles.stripBtnSecondary]} onPress={emailSupport}>
              <Text style={[styles.stripBtnText, styles.stripBtnSecondaryText]}>{t('helpPage:emailSupport')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
  },
  headerBtn: { width: 40 },
  headerTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 42 },
  hero: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  heroText: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  supportCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 190,
    padding: 15,
    width: '47%',
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    marginBottom: 12,
    width: 44,
  },
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800', marginBottom: 7 },
  cardText: { color: '#64748b', flex: 1, fontSize: 12, lineHeight: 18 },
  cardAction: { alignItems: 'center', flexDirection: 'row', gap: 2, marginTop: 10 },
  cardActionText: { color: '#2563eb', fontSize: 12, fontWeight: '800' },
  panel: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  panelHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 12 },
  panelTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  bulletRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  bulletText: { color: '#334155', flex: 1, fontSize: 13, lineHeight: 19 },
  sectionTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 22,
    textTransform: 'uppercase',
  },
  issueList: { gap: 10 },
  issueCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
  },
  issueTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800', marginBottom: 5 },
  issueText: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  supportStrip: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    gap: 16,
    marginTop: 20,
    padding: 18,
  },
  stripCopy: { gap: 6 },
  stripTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  stripText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },
  stripActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stripBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  stripBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  stripBtnSecondary: { backgroundColor: '#ffffff' },
  stripBtnSecondaryText: { color: '#0f172a' },
});

export default HelpSupport;
