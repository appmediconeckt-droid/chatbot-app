// A patient's age / gender / contact / weight from their profile
// (GET /api/auth/getUser/:id), for prescriptions whose record doesn't carry
// them — psychiatrist chat prescriptions only store the patient's name.
// One request per patient; a failed lookup resolves {} and is retried later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../axiosConfig';
import { calculateAgeFromDateOfBirth } from './dateOfBirth';

const requests = new Map();

const detailsOf = (user = {}) => {
  const age = calculateAgeFromDateOfBirth(user.dateOfBirth || user.date_of_birth) ?? user.age;
  return {
    age: age === null || age === undefined || age === '' ? '' : String(age),
    gender: String(user.gender || '').trim(),
    phoneNumber: String(user.phoneNumber || user.phoneNum || user.phone || '').trim(),
    phoneCountryCode: user.phoneCountryCode || '',
    weight: String(user.medicalInfo?.weight || user.weight || '').trim(),
  };
};

export const loadPatientProfileDetails = (patientId) => {
  const id = String(patientId || '').trim();
  if (!id) return Promise.resolve({});
  if (!requests.has(id)) {
    const pending = axiosInstance
      .get(`/api/auth/getUser/${encodeURIComponent(id)}`, { timeout: 15000 })
      .then((response) => detailsOf(response.data?.user || response.data?.data || {}))
      .catch(() => { requests.delete(id); return {}; });
    requests.set(id, pending);
  }
  return requests.get(id);
};

// The consultant's chats (GET /api/chat/chats) carry each patient's age and
// gender — the same "24, male" the Messages list shows — keyed here by chat id
// and by every id the patient appears under. Loaded at most once a minute.
let chatsRequest = null;
let chatsLoadedAt = 0;
const loadChatPatients = () => {
  if (!chatsRequest || Date.now() - chatsLoadedAt > 60000) {
    chatsLoadedAt = Date.now();
    chatsRequest = axiosInstance
      .get('/api/chat/chats', { timeout: 15000 })
      .then((response) => {
        const byId = new Map();
        (response.data?.chats || []).forEach((chat) => {
          const party = chat.otherParty || {};
          const details = {
            age: String(party.age || party.ageYears || '').trim(),
            gender: String(party.gender || '').trim(),
          };
          if (!details.age && !details.gender) return;
          [chat.chatId, chat._id, chat.id, chat.userId, party._id, party.id, party.userId]
            .filter(Boolean)
            .forEach((id) => byId.set(String(id), details));
        });
        return byId;
      })
      .catch(() => { chatsRequest = null; return new Map(); });
  }
  return chatsRequest;
};

const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id : value);

// A consultant's prescription → the patient's age / gender: from the chat it
// was written in, else from the patient's profile.
export const loadPrescriptionPatientDetails = async (item = {}) => {
  const patient = item.patient || {};
  const ids = [item.chatId, item.chat_id, idOf(item.chat), item.publicChatId,
    patient.id, patient._id, patient.userId, item.patientId, item.userId]
    .map(idOf).filter(Boolean).map(String);
  const chats = await loadChatPatients();
  const fromChat = ids.map((id) => chats.get(id)).find(Boolean);
  if (fromChat) return fromChat;
  return loadPatientProfileDetails(idOf(patient.id || patient._id || patient.userId || item.patientId));
};

// The signed-in patient's own details (their own prescriptions).
export const loadOwnProfileDetails = async () =>
  loadPatientProfileDetails(await AsyncStorage.getItem('userId'));

// Prescription patient fields filled from the profile where the record has
// none. `withContact: false` leaves the phone out (a consultant must not see
// an anonymous patient's number).
export const mergeProfileIntoPatient = (patient = {}, profile = {}, { withContact = true } = {}) => ({
  ...patient,
  age: patient.age ?? (profile.age || undefined),
  gender: patient.gender || profile.gender || undefined,
  ...(withContact ? {
    phoneNumber: patient.phoneNumber || patient.phone || profile.phoneNumber || undefined,
    phoneCountryCode: patient.phoneCountryCode || profile.phoneCountryCode || undefined,
  } : {}),
  weight: patient.weight || profile.weight || undefined,
});
