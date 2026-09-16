// Ported from MediconecktApp's src/doctor/dashboard/components/PatientChatScreen.tsx.
// Adaptation: ToastAndroid (Android-only) replaced with the app's cross-platform useToast.
import React, { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';

export default function PatientChatScreen({ name, onBack }) {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState([]);
  const [picker, setPicker] = useState(null);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
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
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton}><Text style={s.back}>‹</Text></Pressable>
        <View style={s.initial}><Text style={s.initialText}>JS</Text></View>
        <Text style={s.name}>{name}</Text>
      </View>
      <ScrollView contentContainerStyle={s.messages} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={s.today}><Text style={s.todayText}>Today</Text></View>
        <Incoming time="9:40 AM">Good morning Dr. Morrow. I took my BP medication this morning but I've been feeling unusually dizzy for the last hour.</Incoming>
        <View style={s.divider}><View style={s.line} /><Text style={s.dividerText}>New Messages</Text><View style={s.line} /></View>
        <Incoming time="9:42 AM">Should I come into the clinic? It's not going away when I sit down.</Incoming>
        <View style={s.outgoingWrap}>
          <Text style={s.outTime}>Just now <Text style={s.you}>You</Text></Text>
          <View style={s.outRow}>
            <View style={s.outgoing}>
              <Text style={s.outgoingText}>Hello John. I'm sorry to hear that. Did you check your blood pressure recently? Let's have a quick video call to assess.</Text>
            </View>
            <View style={s.doctor}><Text style={s.doctorEmoji}>👨🏻‍⚕</Text></View>
          </View>
        </View>
        {sent.map((text, index) => (
          <View key={index} style={s.sent}><Text style={s.outgoingText}>{text}</Text></View>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actions}>
        <Quick icon="calendar" text="Schedule Appointment" onPress={() => addChatAction('Appointment scheduling request sent.')} />
        <Quick icon="file" text="Request Reports" onPress={() => setPicker('reports')} />
        <Quick icon="message" text="Prescription" onPress={() => addChatAction('Prescription shared with patient.')} />
      </ScrollView>
      <View style={s.composer}>
        <Pressable onPress={() => setPicker('attach')} style={s.composerIcon}><AppIcon name="attachment" size={21} color="#526078" /></Pressable>
        <Pressable style={s.composerIcon}><Text style={s.emoji}>☺</Text></Pressable>
        <TextInput value={message} onChangeText={setMessage} multiline placeholder="Type a message to John..." placeholderTextColor="#7B8493" style={s.input} />
        <Pressable onPress={() => showToast('Hold to record a voice message')} style={s.composerIcon}>
          <AppIcon name="mic" size={20} color="#526078" />
        </Pressable>
        <Pressable onPress={send} style={s.send}><AppIcon name="send" size={20} color="#FFF" strokeWidth={2} /></Pressable>
      </View>
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={s.overlay} onPress={() => setPicker(null)}>
          <View style={s.sheet}>
            <View style={s.handle} />
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
                <View style={s.optionIcon}><AppIcon name="file" size={19} color="#07BFBD" /></View>
                <Text style={s.optionText}>{option}</Text>
                <Text style={s.optionArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
function Incoming({ time, children }) {
  return (
    <View style={s.incomingBlock}>
      <View style={s.incomingMeta}>
        <View style={s.smallInitial}><Text style={s.smallInitialText}>JS</Text></View>
        <Text style={s.sender}>John Smith</Text>
        <Text style={s.inTime}>{time}</Text>
      </View>
      <View style={s.incoming}><Text style={s.incomingText}>{children}</Text></View>
    </View>
  );
}
function Quick({ text, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={s.quick}>
      <AppIcon name={icon} size={15} color="#07BFBD" />
      <Text style={s.quickText}>{text}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FC' },
  header: { height: 66, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backButton: { width: 29 },
  back: { fontSize: 34, lineHeight: 36, color: '#26364D' },
  initial: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 14, fontWeight: '700', color: '#07BFBD' },
  name: { fontSize: 19, fontWeight: '700', color: '#26364D', marginLeft: 10 },
  messages: { padding: 17, paddingBottom: 25 },
  today: { alignSelf: 'center', backgroundColor: '#EEF0F6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 30 },
  todayText: { fontSize: 9, color: '#667085' },
  incomingBlock: { marginBottom: 30 },
  incomingMeta: { flexDirection: 'row', alignItems: 'center' },
  smallInitial: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  smallInitialText: { fontSize: 11, fontWeight: '700', color: '#07BFBD' },
  sender: { fontSize: 12, fontWeight: '700', color: '#26364D' },
  inTime: { fontSize: 9, color: '#526078', marginLeft: 7 },
  incoming: { width: '70%', marginLeft: 47, marginTop: 4, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C7D0DF', borderRadius: 15, borderTopLeftRadius: 4, padding: 15, shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  incomingText: { fontSize: 14, lineHeight: 21, color: '#26364D' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  line: { height: 1, backgroundColor: '#D8DFE9', flex: 1 },
  dividerText: { fontSize: 11, fontWeight: '600', color: '#07BFBD' },
  outgoingWrap: { alignItems: 'flex-end', marginTop: 8 },
  outTime: { fontSize: 9, color: '#667085', marginRight: 42, marginBottom: 5 },
  you: { fontWeight: '700', color: '#344054' },
  outRow: { flexDirection: 'row', alignItems: 'flex-start' },
  outgoing: { width: '72%', backgroundColor: '#08E0D5', borderRadius: 15, borderTopRightRadius: 4, padding: 15, shadowColor: '#07BFBD', shadowOpacity: 0.16, shadowRadius: 4, elevation: 2 },
  outgoingText: { fontSize: 14, lineHeight: 21, color: '#FFF' },
  doctor: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E6F6F4', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  doctorEmoji: { fontSize: 17 },
  sent: { alignSelf: 'flex-end', maxWidth: '72%', backgroundColor: '#08F9ED', borderRadius: 15, borderTopRightRadius: 4, padding: 14, marginTop: 9 },
  actions: { gap: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9' },
  quick: { height: 42, borderWidth: 1, borderColor: '#BCFBFF', borderRadius: 21, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 7, backgroundColor: '#FFF' },
  quickText: { fontSize: 11, fontWeight: '700', color: '#07BFBD' },
  composer: { minHeight: 58, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C9D2DF', borderRadius: 29, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginHorizontal: 9, marginVertical: 8, gap: 8, shadowColor: '#17243A', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  composerIcon: { width: 30, height: 38, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 21, color: '#526078' },
  input: { flex: 1, minHeight: 42, maxHeight: 96, fontSize: 13, color: '#26364D', paddingVertical: 9 },
  send: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#08F9ED', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(18,28,45,.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 17 },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: '#17243A' },
  sheetHelp: { fontSize: 12, lineHeight: 18, color: '#667085', marginTop: 5, marginBottom: 13 },
  option: { height: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  optionIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  optionText: { fontSize: 14, fontWeight: '500', color: '#26364D' },
  optionArrow: { marginLeft: 'auto', fontSize: 22, color: '#98A2B3' },
});
