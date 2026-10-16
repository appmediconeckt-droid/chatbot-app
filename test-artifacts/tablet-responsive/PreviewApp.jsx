// Isolated visual test entry. The production entry never imports this file.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ResponsiveAppFrame } from '../../src/components/common/ResponsiveLayout';
import { LanguageProvider } from '../../src/contexts/LanguageContext';
import Text from '../../src/components/TranslatedText';
import api from '../../src/axiosConfig';
import ReceptionistPortal from '../../src/features/receptionist/ReceptionistPortal';
import DoctorOnboarding from '../../src/screens/auth/DoctorOnboarding';
import UserOnboarding from '../../src/screens/auth/UserOnboarding';
import CounselorOnboarding from '../../src/screens/auth/CounselorOnboarding';
import { indiaToday } from '../../src/features/receptionist/receptionistUtils';
import '../../src/i18n';

const noop = () => {};
const clinic = { id: 'preview-clinic', clinic_name: 'Tablet Preview Clinic & Community Health Centre', location: 'Preview address with a longer line to check wrapping on small tablet windows', phone_number: '0000000000' };
const doctor = { id: 'preview-doctor', fullName: 'Tablet Preview Doctor', specialization: ['Psychiatry'], qualification: 'Preview qualification', email: 'doctor@example.test', phoneNumber: '0000000000', experience: 10 };
const profile = { id: 'preview-staff', role: 'receptionist', fullName: 'Tablet Preview Staff', email: 'staff@example.test', phoneNumber: '0000000000', clinic_id: clinic.id, clinic_name: clinic.clinic_name, assignedDoctorName: doctor.fullName, staffId: 'PREVIEW-001', department: 'Front desk', shift: 'Morning', shiftStartTime: '09:00', shiftEndTime: '17:00' };
const appointments = Array.from({ length: 6 }, (_, index) => ({ id: `preview-visit-${index}`, source: index % 2 ? 'walkin' : 'online', patientName: `Preview patient ${index + 1}`, phoneNumber: '0000000000', age: 30, gender: 'Female', date: indiaToday(), time: '10:30', clinicId: clinic.id, token: index + 1, status: index === 5 ? 'completed' : 'confirmed', queueStatus: index === 3 ? 'skipped' : index === 5 ? 'completed' : 'waiting', emergency: index === 0, emergencyReason: index === 0 ? 'Preview reason to verify that long text wraps inside a tablet card.' : '', symptoms: 'Preview symptoms', timing: {} }));
const history = appointments.map((row, index) => ({ id: `history-${index}`, source: row.source, patient: { name: row.patientName, phoneNumber: row.phoneNumber, age: row.age, gender: row.gender }, clinicId: clinic.id, token: row.token, checkedDate: indiaToday(), checkedAt: `${indiaToday()}T05:00:00Z`, diagnosis: 'Preview diagnosis for layout validation', hasPrescription: true, prescription: { patient: { name: row.patientName, gender: row.gender }, diagnosis: 'Preview diagnosis', medicine: 'Preview medicine', advice: 'Preview instructions' } }));

// Every request is intercepted in this entry; preview data stays in memory.
api.get = async (url) => {
  if (url === '/api/auth/me') return { data: { user: profile } };
  if (url === '/api/staff/receptionist/dashboard') return { data: { doctor, clinics: [clinic], appointments, waiting: appointments.filter(row => row.queueStatus === 'waiting'), currentPatients: [], summary: { total: 6, waiting: 4, completed: 1 }, updatedAt: new Date().toISOString() } };
  if (url === '/api/staff/appointments') return { data: { appointments, clinics: [clinic], doctor, total: 6, completed: 1 } };
  if (url === '/api/staff/patient-history') return { data: { records: history, total: history.length, clinics: [clinic], doctor, summary: { visits: 6, prescriptions: 6 }, updatedAt: new Date().toISOString() } };
  throw new Error('This request is disabled in the tablet preview.');
};
api.patch = api.post = api.delete = async () => { throw new Error('Saving is disabled in the tablet preview.'); };

const tours = [null, DoctorOnboarding, UserOnboarding, CounselorOnboarding];
const names = ['Receptionist', 'Doctor tour', 'Patient tour', 'Consultant tour'];
export default function PreviewApp() {
  const [screen, setScreen] = useState(0);
  const Tour = tours[screen];
  return <SafeAreaProvider><LanguageProvider><ResponsiveAppFrame>
    <View style={s.toolbar}>{names.map((name, index) => <Pressable key={name} onPress={() => setScreen(index)} style={s.tab}><Text>{name}</Text></Pressable>)}</View>
    {Tour ? <Tour navigation={{ navigate: noop, reset: noop }} route={{ params: {} }} /> : <ReceptionistPortal initialProfile={profile} onLogout={noop} />}
  </ResponsiveAppFrame></LanguageProvider></SafeAreaProvider>;
}
const s = StyleSheet.create({ toolbar: { paddingTop: 24, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', backgroundColor: '#FFFFFF' }, tab: { paddingHorizontal: 14, paddingVertical: 10 } });
