// Ported from MediconecktApp's src/doctor/dashboard/components/NewFollowUpScreen.tsx.
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import FollowUpDetailsScreen from './FollowUpDetailsScreen';

export default function NewFollowUpScreen({ onBack }) {
  const [patient, setPatient] = useState('');
  const [type, setType] = useState('');
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState('Routine');
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(null);
  const [created, setCreated] = useState(null);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (created) setCreated(null);
      else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [created, onBack]);
  const create = () => {
    if (!patient || !type || !date || !time || !provider) {
      Alert.alert('Missing information', 'Please complete all required fields.');
      return;
    }
    setCreated({ patient, date, time, type, provider, priority, notes });
  };
  if (created) return <FollowUpDetailsScreen details={created} onBack={onBack} onReschedule={() => setCreated(null)} />;
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.title}>New Follow-up</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Label text="PATIENT" />
        <View style={s.inputBox}>
          <AppIcon name="search" size={17} color="#667085" />
          <TextInput value={patient} onChangeText={setPatient} placeholder="Search patient name or ID..." placeholderTextColor="#8A94A4" style={s.input} />
        </View>
        <Label text="FOLLOW-UP TYPE" />
        <Select value={type} placeholder="Select type" onPress={() => setOpen(open === 'type' ? null : 'type')} />
        {open === 'type' && <Options values={['Consultation Review', 'Lab Results', 'Medication Review', 'Post-op Review']} onSelect={(value) => { setType(value); setOpen(null); }} />}
        <View style={s.row}>
          <View style={s.half}>
            <Label text="DATE" />
            <View style={s.inputBox}>
              <AppIcon name="calendar" size={17} color="#667085" />
              <TextInput value={date} onChangeText={setDate} placeholder="mm/dd/yyyy" keyboardType="numbers-and-punctuation" placeholderTextColor="#667085" style={s.input} />
            </View>
          </View>
          <View style={s.half}>
            <Label text="TIME" />
            <View style={s.inputBox}>
              <AppIcon name="clock" size={17} color="#667085" />
              <TextInput value={time} onChangeText={setTime} placeholder="--:--" placeholderTextColor="#667085" style={s.input} />
            </View>
          </View>
        </View>
        <Label text="ASSIGN DOCTOR" />
        <Select value={provider} placeholder="Select provider" icon="users" onPress={() => setOpen(open === 'provider' ? null : 'provider')} />
        {open === 'provider' && <Options values={['Dr. A. Sharma', 'Dr. Sarah Mitchell', 'Dr. Sarah Jenkins']} onSelect={(value) => { setProvider(value); setOpen(null); }} />}
        <Label text="PRIORITY LEVEL" />
        <View style={s.priority}>
          {['Routine', 'Medium', 'Urgent'].map((item) => (
            <Pressable key={item} onPress={() => setPriority(item)} style={[s.priorityItem, priority === item && s.priorityActive]}>
              <Text style={[s.priorityText, priority === item && s.priorityTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Label text="NOTES & INSTRUCTIONS" />
        <TextInput value={notes} onChangeText={setNotes} multiline textAlignVertical="top" placeholder="Add any specific preparation instructions or clinical notes here..." placeholderTextColor="#8A94A4" style={s.notes} />
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={create} style={s.create}>
          <AppIcon name="calendar" size={16} color="#FFF" />
          <Text style={s.createText}>Create Follow-up</Text>
        </Pressable>
      </View>
    </View>
  );
}
function Label({ text }) {
  return <Text style={s.label}>{text}</Text>;
}
function Select({ value, placeholder, onPress, icon }) {
  return (
    <Pressable onPress={onPress} style={s.inputBox}>
      {icon && <AppIcon name={icon} size={17} color="#667085" />}
      <Text style={[s.selectText, !value && s.placeholder]}>{value || placeholder}</Text>
      <Text style={s.chevron}>⌄</Text>
    </Pressable>
  );
}
function Options({ values, onSelect }) {
  return (
    <View style={s.options}>
      {values.map((value) => (
        <Pressable key={value} onPress={() => onSelect(value)} style={s.option}>
          <Text style={s.optionText}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { height: 61, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  back: { fontSize: 33, lineHeight: 35, color: '#26364D', marginRight: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#07BFBD' },
  content: { padding: 13, paddingBottom: 30 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: '#526078', marginTop: 14, marginBottom: 7 },
  inputBox: { height: 49, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#BFC9D8', borderRadius: 7, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  input: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  selectText: { fontSize: 14, color: '#17243A', marginLeft: 4 },
  placeholder: { color: '#526078' },
  chevron: { marginLeft: 'auto', fontSize: 16, color: '#667085' },
  options: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, marginTop: 4, overflow: 'hidden', zIndex: 3 },
  option: { height: 42, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  optionText: { fontSize: 13, color: '#344054' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  priority: { height: 43, backgroundColor: '#E6E9EE', borderRadius: 7, flexDirection: 'row', padding: 3 },
  priorityItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 5 },
  priorityActive: { backgroundColor: '#FFF', shadowColor: '#17243A', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  priorityText: { fontSize: 12, color: '#667085' },
  priorityTextActive: { color: '#07BFBD', fontWeight: '700' },
  notes: { height: 126, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#BFC9D8', borderRadius: 7, padding: 12, fontSize: 13, lineHeight: 19, color: '#17243A' },
  footer: { height: 72, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9', padding: 11 },
  create: { height: 49, backgroundColor: '#08F9ED', borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
