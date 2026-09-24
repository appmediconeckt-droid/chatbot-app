// Ported from MediconecktApp's src/doctor/dashboard/components/PatientChatScreen.tsx.
// Adaptation: ToastAndroid (Android-only) replaced with the app's cross-platform useToast.
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles, colors } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';

const getInitials = (name) => name.split(' ').filter(Boolean).map((word) => word[0]).slice(0, 2).join('').toUpperCase();
const EMOJI_CATEGORIES = [
  {
    label: 'Medical',
    items: ['🩺', '💊', '🌡️', '💉', '🩹', '🩻', '🧬', '🫀', '🧠', '🦴', '🚑', '🏥', '😷', '🤒', '🤕', '🤢', '🥴', '🦠'],
  },
  {
    label: 'Status & Replies',
    items: ['✅', '❌', '⚠️', '❓', '❗', '⏰', '👍', '👎', '🙏', '👏', '🤝', '💪'],
  },
  {
    label: 'Feelings',
    items: ['😊', '🙂', '😅', '😢', '😮', '😃', '😔', '😌', '😬', '🥲', '😴', '🤗'],
  },
  {
    label: 'Common',
    items: ['❤️', '📅', '📎', '📞', '📷', '📝', '🎉', '👋', '🙌', '☀️', '🌙', '🔥'],
  },
];
const formatTime = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function PatientChatScreen({ name, avatar, onBack, onProfilePress }) {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState([]);
  const [picker, setPicker] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const recordTimer = useRef(null);
  const firstName = name.split(' ')[0];
  const initials = getInitials(name);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
  useEffect(() => () => { if (recordTimer.current) clearInterval(recordTimer.current); }, []);
  useEffect(() => {
    // Android edge-to-edge doesn't resize the window, so lift the composer by
    // the measured keyboard height instead (same pattern as the patient ChatBox).
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardHeight = event?.endCoordinates?.height || 0;
      setKeyboardInset(Math.max(0, keyboardHeight - insets.bottom));
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, [insets.bottom]);
  const send = () => {
    const text = message.trim();
    if (!text) return;
    setSent((current) => [...current, text]);
    setMessage('');
  };
  const addChatAction = (text) => {
    setSent((current) => [...current, text]);
    setPicker(null);
  };
  const startRecording = () => {
    setRecordSeconds(0);
    setRecording(true);
    recordTimer.current = setInterval(() => setRecordSeconds((current) => current + 1), 1000);
  };
  const stopRecording = (shouldSend) => {
    if (recordTimer.current) clearInterval(recordTimer.current);
    recordTimer.current = null;
    setRecording(false);
    if (shouldSend && recordSeconds > 0) {
      setSent((current) => [...current, `🎤 Voice message · ${formatTime(recordSeconds)}`]);
      showToast('Voice message sent');
    } else if (shouldSend) {
      showToast('Recording was too short');
    } else {
      showToast('Recording discarded');
    }
    setRecordSeconds(0);
  };
  const addEmoji = (emoji) => setMessage((current) => current + emoji);
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Pressable onPress={onProfilePress} style={s.headerProfile} hitSlop={4}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={s.headerAvatar} />
          ) : (
            <View style={s.initial}><Text style={s.initialText}>{initials}</Text></View>
          )}
          <Text style={s.name}>{name}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.messages} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={s.today}><Text style={s.todayText}>Today</Text></View>
        <Incoming name={name} avatar={avatar} initials={initials} time="9:40 AM">Good morning Dr. Morrow. I took my BP medication this morning but I've been feeling unusually dizzy for the last hour.</Incoming>
        <View style={s.divider}><View style={s.line} /><Text style={s.dividerText}>New Messages</Text><View style={s.line} /></View>
        <Incoming name={name} avatar={avatar} initials={initials} time="9:42 AM">Should I come into the clinic? It's not going away when I sit down.</Incoming>
        <View style={s.outgoingWrap}>
          <Text style={s.outTime}>Just now <Text style={s.you}>You</Text></Text>
          <View style={s.outRow}>
            <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.outgoing}>
              <Text style={s.outgoingText}>Hello {firstName}. I'm sorry to hear that. Did you check your blood pressure recently? Let's have a quick video call to assess.</Text>
            </LinearGradient>
            <Image source={{ uri: 'https://i.pravatar.cc/80?img=32' }} style={s.doctorAvatar} />
          </View>
        </View>
        {sent.map((text, index) => (
          <LinearGradient key={index} colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sent}>
            <Text style={s.outgoingText}>{text}</Text>
          </LinearGradient>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actions}>
        <Quick icon="calendar" text="Schedule Appointment" onPress={() => addChatAction('Appointment scheduling request sent.')} />
        <Quick icon="file" text="Request Reports" onPress={() => setPicker('reports')} />
        <Quick icon="message" text="Prescription" onPress={() => addChatAction('Prescription shared with patient.')} />
      </ScrollView>
      <View style={[s.composer, Platform.OS === 'android' && { marginBottom: 8 + keyboardInset }]}>
        {!recording && (
          <Pressable onPress={() => setPicker('attach')} style={s.composerIcon}><AppIcon name="attachment" size={18} color="#7B8493" strokeWidth={1.9} /></Pressable>
        )}
        {!recording && (
          <Pressable onPress={() => setPicker('emoji')} style={s.composerIcon}><Text style={s.emoji}>☺</Text></Pressable>
        )}
        {recording ? (
          <View style={s.recordingRow}>
            <View style={s.recordingDot} />
            <Text style={s.recordingText}>Recording… {formatTime(recordSeconds)}</Text>
            <Pressable onPress={() => stopRecording(false)} style={s.recordingCancel} hitSlop={8}>
              <AppIcon name="x" size={13} color="#8A94A4" strokeWidth={2.2} />
            </Pressable>
          </View>
        ) : (
          <TextInput value={message} onChangeText={setMessage} multiline placeholder={`Message ${firstName}...`} placeholderTextColor="#94A0B3" style={s.input} />
        )}
        <Pressable onPress={() => (recording ? stopRecording(true) : startRecording())} style={s.composerIcon}>
          <AppIcon name={recording ? 'check-mark' : 'mic'} size={recording ? 16 : 17} color={recording ? colors.blue : '#7B8493'} strokeWidth={recording ? 2.6 : 1.9} />
        </Pressable>
        {!recording && (
          <Pressable onPress={send} style={s.sendWrap}>
            <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.send}>
              <AppIcon name="send" size={17} color="#FFF" strokeWidth={2.1} />
            </LinearGradient>
          </Pressable>
        )}
      </View>
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={s.overlay} onPress={() => setPicker(null)}>
          <View style={s.sheet}>
            <View style={s.handle} />
            {picker === 'emoji' ? (
              <>
                <Text style={s.sheetTitle}>Emoji</Text>
                <Text style={s.sheetHelp}>Tap to add to your message.</Text>
                <ScrollView style={s.emojiScroll} showsVerticalScrollIndicator={false}>
                  {EMOJI_CATEGORIES.map((category) => (
                    <View key={category.label} style={s.emojiCategory}>
                      <Text style={s.emojiCategoryLabel}>{category.label}</Text>
                      <View style={s.emojiGrid}>
                        {category.items.map((emoji) => (
                          <Pressable key={emoji} onPress={() => addEmoji(emoji)} style={s.emojiOption} hitSlop={4}>
                            <Text style={s.emojiOptionText}>{emoji}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={s.sheetTitle}>{picker === 'reports' ? 'Request a report' : 'Attach a file'}</Text>
                <Text style={s.sheetHelp}>{picker === 'reports' ? 'Choose which patient document you need.' : 'Choose the type of file to add to this chat.'}</Text>
                {(picker === 'reports'
                  ? ['Lab Reports', 'Imaging / Scan Reports', 'Previous Prescriptions', 'Discharge Summary']
                  : ['Photo or Image', 'PDF Document', 'Lab Report', 'Prescription']
                ).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => addChatAction(picker === 'reports' ? `${option} requested from patient.` : `${option} attached.`)}
                    style={s.option}
                  >
                    <View style={s.optionIcon}><AppIcon name="file" size={19} color="#0D9488" /></View>
                    <Text style={s.optionText}>{option}</Text>
                    <Text style={s.optionArrow}>›</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
function Incoming({ name, avatar, initials, time, children }) {
  return (
    <View style={s.incomingBlock}>
      <View style={s.incomingRow}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={s.smallAvatar} />
        ) : (
          <View style={s.smallInitial}><Text style={s.smallInitialText}>{initials}</Text></View>
        )}
        <View style={s.incomingContent}>
          <View style={s.incomingMeta}>
            <Text style={s.sender}>{name}</Text>
            <Text style={s.inTime}>{time}</Text>
          </View>
          <View style={s.incoming}><Text style={s.incomingText}>{children}</Text></View>
        </View>
      </View>
    </View>
  );
}
function Quick({ text, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={s.quick}>
      <AppIcon name={icon} size={15} color="#0D9488" />
      <Text style={s.quickText}>{text}</Text>
    </Pressable>
  );
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 43, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backButton: { width: 24, height: 36, alignItems: 'flex-start', justifyContent: 'center', marginRight: 3 },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1, height: '100%' },
  initial: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 15, fontWeight: '700', color: '#0D9488' },
  headerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DCFCFF' },
  name: { fontSize: 18, fontWeight: '700', color: '#26364D', marginLeft: 9 },
  messages: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 38 },
  today: { alignSelf: 'center', backgroundColor: '#EEF0F6', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 4, marginBottom: 29 },
  todayText: { fontSize: 12, color: '#667085' },
  incomingBlock: { marginBottom: 28 },
  incomingRow: { flexDirection: 'row', alignItems: 'flex-start' },
  incomingContent: { flex: 1, marginLeft: 14 },
  incomingMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  smallInitial: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  smallInitialText: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
  smallAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DCFCFF', marginTop: 15 },
  sender: { fontSize: 14, fontWeight: '700', color: '#26364D' },
  inTime: { fontSize: 12, color: '#526078', marginLeft: 7 },
  incoming: { alignSelf: 'flex-start', maxWidth: '80%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C7D0DF', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 13, shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  incomingText: { fontSize: 15, lineHeight: 22, color: '#26364D' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 28 },
  line: { height: 1, backgroundColor: '#D8DFE9', flex: 1 },
  dividerText: { fontSize: 13, fontWeight: '600', color: '#0D9488' },
  outgoingWrap: { alignItems: 'flex-end', marginTop: 8 },
  outTime: { fontSize: 12, color: '#667085', marginRight: 47, marginBottom: 6 },
  you: { fontWeight: '700', color: '#344054' },
  outRow: { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '92%' },
  outgoing: {
    flexShrink: 1,
    borderRadius: 19,
    borderBottomRightRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#0F5F58',
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  outgoingText: { fontSize: 15, lineHeight: 21, color: '#FFFFFF', letterSpacing: 0.1 },
  doctorAvatar: { width: 30, height: 30, borderRadius: 15, marginLeft: 10, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#17243A', shadowOpacity: 0.12, shadowRadius: 3, elevation: 1 },
  sent: {
    alignSelf: 'flex-end',
    maxWidth: '78%',
    borderRadius: 19,
    borderBottomRightRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 10,
    shadowColor: '#0F5F58',
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actions: { gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9' },
  quick: { height: 28, borderWidth: 1, borderColor: '#BCFBFF', borderRadius: 14, paddingHorizontal: 11, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 5, backgroundColor: '#FFF' },
  quickText: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
  composer: {
    minHeight: 44,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 8,
    gap: 3,
    shadowColor: '#17243A',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  composerIcon: { width: 26, height: 34, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 17, color: '#7B8493' },
  input: { flex: 1, minHeight: 34, maxHeight: 90, fontSize: 13.5, lineHeight: 18, color: '#26364D', paddingVertical: 8, paddingHorizontal: 2 },
  recordingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, height: 34 },
  recordingDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#D2564B' },
  recordingText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#3C4759' },
  recordingCancel: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  sendWrap: {},
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(18,28,45,.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 17 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#17243A' },
  sheetHelp: { fontSize: 14, lineHeight: 20, color: '#667085', marginTop: 5, marginBottom: 13 },
  option: { height: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  optionIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  optionText: { fontSize: 15, fontWeight: '500', color: '#26364D' },
  optionArrow: { marginLeft: 'auto', fontSize: 22, color: '#98A2B3' },
  emojiScroll: { maxHeight: 380 },
  emojiCategory: { marginBottom: 16 },
  emojiCategoryLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: '#8A94A4', textTransform: 'uppercase', marginBottom: 9 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F7F9FC', alignItems: 'center', justifyContent: 'center' },
  emojiOptionText: { fontSize: 24 },
});
