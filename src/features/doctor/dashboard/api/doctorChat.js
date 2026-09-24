// Port of the web doctor chat layer (Component/DoctorDashboard/doctorChatApi.js
// + the patient list logic of DoctorDashboardChat/DoctorSmsPatient.jsx):
//   GET /api/chat/chats                         → conversations
//   GET /api/appointments?doctor_id=<id>         → remote-consultation lookup
//   PATCH /api/appointments/:id                  → "Check & Complete Appointment"
// The conversation itself (messages, attachments, voice / video calls) opens
// in the app's existing chat screen (route 'SMSInput'), which already talks
// to /api/chat/chat/:id/messages and /api/video/calls/* exactly like the web.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../../../axiosConfig';
import { pickFirst } from './doctorAppointments';

export const unwrapApiArray = (value) => {
  if (Array.isArray(value)) return value;
  for (const key of ['chats', 'messages', 'appointments', 'data', 'results']) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  if (Array.isArray(value?.data?.data)) return value.data.data;
  return [];
};

export const getCurrentUserId = async () => {
  try {
    const user = JSON.parse((await AsyncStorage.getItem('userData')) || 'null');
    return pickFirst(user?._id, user?.id, await AsyncStorage.getItem('userId'));
  } catch {
    return AsyncStorage.getItem('userId');
  }
};

const formatChatTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getLastMessageText = (chat) => {
  const last = chat?.lastMessage || chat?.last_message || chat?.latest_message || chat;
  const text = pickFirst(last?.content, last?.message, last?.text);
  if (text) return String(text);
  if (last?.attachmentUrl || last?.attachment_url || last?.file_url) return '📎 Attachment';
  return 'No messages yet';
};

export async function getChatList() {
  const { data } = await axiosInstance.get('/api/chat/chats');
  return unwrapApiArray(data);
}

// Chat list → patient rows (web DoctorSmsPatient loadPatients).
export const buildChatPatients = (chats, currentUserId) => {
  const rows = chats.map((chat) => {
    const party = chat.otherParty || chat.patient || {};
    const receiverId = pickFirst(party.id, party._id, party.userId, chat.userId, chat.patient_id);
    if (!receiverId || String(receiverId) === String(currentUserId)) return null;
    const last = chat.lastMessage || chat.last_message || chat.latest_message;
    const lastActivityAt = pickFirst(last?.createdAt, last?.created_at, chat.updatedAt, chat.updated_at, chat.startedAt, chat.created_at);
    const condition = pickFirst(party.condition, party.diagnosis, chat.condition, chat.topic, chat.reason, 'No condition');
    return {
      id: String(receiverId),
      receiverId: String(receiverId),
      chatId: pickFirst(chat.chatId, chat.id, chat._id),
      name: pickFirst(party.full_name, party.fullName, party.fullname, party.name, party.patient_name, chat.patient_name, 'Unknown Patient'),
      age: pickFirst(party.age, 'NA'),
      gender: pickFirst(party.gender, ''),
      condition,
      status: String(pickFirst(party.status, chat.status, 'Stable')),
      phone: pickFirst(party.contact_number, party.phone, party.phone_number, party.phoneNumber, ''),
      bloodGroup: pickFirst(party.bloodGroup, party.blood_group, ''),
      avatarUrl: pickFirst(party.profilePhoto?.url, party.avatarUrl, party.avatar_url, typeof party.profilePhoto === 'string' ? party.profilePhoto : undefined, ''),
      online: Boolean(party.isOnline || party.online || party.is_online),
      lastMessage: getLastMessageText(chat),
      messageTime: formatChatTime(lastActivityAt),
      lastActivityAt: lastActivityAt || 0,
      unread: Number(pickFirst(chat.unreadCount, chat.unread, chat.unread_count, party.unread, 0)) || 0,
    };
  }).filter(Boolean);
  // One row per patient, newest activity first.
  const unique = Array.from(new Map(rows.map((row) => [row.id, row])).values());
  return unique.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
};

export async function loadChatPatients() {
  const [chats, currentUserId] = await Promise.all([getChatList(), getCurrentUserId()]);
  return buildChatPatients(chats, currentUserId);
}

// Open the conversation in the app chat screen; optionally start a call.
export const openPatientChat = (navigation, patient, autoStartCallType) => {
  const selectedUser = {
    id: patient.chatId,
    chatId: patient.chatId,
    _id: patient.receiverId,
    userId: patient.receiverId,
    receiverId: patient.receiverId,
    name: patient.name,
    anonymous: patient.name,
    gender: patient.gender,
    age: patient.age,
    avatarUrl: patient.avatarUrl,
  };
  navigation.navigate('SMSInput', {
    selectedUser,
    chatId: patient.chatId,
    chatData: selectedUser,
    ...(autoStartCallType ? { autoStartCallType } : {}),
  });
};

// Dashboard "Video Call / Voice Call": find this patient's chat and open it.
export async function openChatForPatientId(navigation, patientUserId, autoStartCallType) {
  const patients = await loadChatPatients();
  const match = patients.find((p) => String(p.receiverId) === String(patientUserId));
  if (!match) return false;
  openPatientChat(navigation, match, autoStartCallType);
  return true;
}

// ---- remote consultation (web "Check & Complete Appointment") -------------
const isRemote = (appointment) => {
  const mode = String(pickFirst(appointment.consultation_mode, appointment.consultationMode, appointment.mode, '')).toLowerCase();
  return mode.includes('video') || mode.includes('voice');
};
const isCompleted = (appointment) =>
  String(pickFirst(appointment.appointment_status, appointment.status, '')).toLowerCase().includes('complete');

export const findOpenRemoteAppointment = (appointments, patientId) =>
  appointments.find((item) => {
    const pid = pickFirst(item.patient_id, item.patientId, item.patient?.id, item.patient?._id);
    return String(pid) === String(patientId) && isRemote(item) && !isCompleted(item);
  }) || null;

export async function loadDoctorAppointments(doctorId) {
  const response = await axiosInstance.get('/api/appointments', { params: { doctor_id: doctorId } });
  return unwrapApiArray(response.data);
}

export async function completeRemoteConsultation(appointment, form) {
  const tests = (form.recommendedTests || []).filter((t) => t.testName.trim());
  const primary = tests[0] || {};
  const appointmentId = pickFirst(appointment.id, appointment._id);
  await axiosInstance.patch(`/api/appointments/${appointmentId}`, {
    appointment_status: 'completed',
    diagnosis: form.diagnosis.trim(),
    medicine: form.medicine.trim(),
    advice: form.advice.trim(),
    testName: primary.testName || null,
    completeBy: primary.completeBy || null,
    reason: primary.reason || '',
    instructions: primary.instructions || '',
    recommended_tests: tests,
    recommendedTests: tests,
  });
}
