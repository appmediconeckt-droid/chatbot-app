// Direct video / voice calls from the doctor dashboard — no chat screen.
//
// Same flow as the web doctor dashboard (DoctorDashboard/doctorCallRequest.js
// initiateDoctorCall + doctorChatApi.js startCall):
//   1. connect the doctor's socket — the server prepares that exact socket
//      for the call, so the request carries its id;
//   2. POST /api/video/calls/initiate { receiverId, receiverType: 'user',
//      callType: 'video' | 'voice', socketId } — the caller comes from the token.
// Sending initiatorType 'counsellor' with a doctor's id made the server look
// the doctor up as a counsellor and fail ("Failed to initiate call").
// CALLER_TYPE is only for the call modals: it gives the doctor the provider
// view; it is never sent to the server.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../../../axiosConfig';
import { socketService } from '../../../../services/socketService';
import { pickFirst } from './doctorAppointments';
import { getNotificationOnlyCallMessage, isNotificationOnlyCallResponse } from '../../../../utils/callRequestStatus';

const CALLER_TYPE = 'counsellor';

export const getDoctorCallerId = async () => {
  try {
    const user = JSON.parse((await AsyncStorage.getItem('userData')) || 'null');
    const id = pickFirst(user?._id, user?.id, user?.user?._id, user?.user?.id);
    if (id) return String(id);
  } catch {
    // fall through to the plain id key
  }
  const stored = await AsyncStorage.getItem('userId');
  return stored ? String(stored) : null;
};

/**
 * Start a call to a patient.
 * Resolves to { notificationOnly: true, message } when the patient is offline
 * and the server only sent them a notification, otherwise to
 * { callData, callerId } ready for VideoCallModal / VoiceCallModal.
 */
export async function startDirectCall({ patientId, patientName, mode }) {
  const callerId = await getDoctorCallerId();
  if (!callerId) throw new Error('Your doctor account id was not found. Please log in again.');
  const isVideo = mode === 'video';

  let socket;
  try {
    socket = await socketService.connect();
  } catch {
    throw new Error('Could not connect to the call server. Check your connection and retry.');
  }
  if (!socket?.id) throw new Error('Call connection is not ready. Please retry.');

  let data;
  try {
    ({ data } = await axiosInstance.post('/api/video/calls/initiate', {
      receiverId: String(patientId),
      receiverType: 'user',
      callType: isVideo ? 'video' : 'voice',
      socketId: socket.id,
    }, { timeout: 20000 }));
  } catch (error) {
    // A retry after a lost answer finds the request already ringing: carry on
    // with it instead of leaving the patient ringing while the doctor sees an
    // error (web startCall).
    const pending = error?.response?.data;
    if (pending?.callId && pending.status === 'pending') data = { ...pending, success: true };
    else if (['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) throw new Error('The call server did not respond in time. Please retry.');
    else throw error;
  }
  if (!data || data.success === false) throw new Error(data?.error || data?.message || 'Call could not be started. Please retry.');

  if (isNotificationOnlyCallResponse(data)) {
    return { notificationOnly: true, message: getNotificationOnlyCallMessage(data, patientName || 'The patient') };
  }

  const call = data.call || data.callData || data.data || {};
  const callId = String(pickFirst(call.id, call.callId, call.call_id, call._id, data.callId) || '');
  if (!callId) throw new Error(data.error || 'Call could not be started. Please retry.');
  // The Stream room is the call's own id, as on the web (VideoCallModal
  // resolveCallId → client.call('default', callId)). A separate room id from
  // the server put the doctor in one room and a web patient in another.
  return {
    callerId,
    callData: {
      callId,
      id: callId,
      roomId: callId,
      streamCallId: callId,
      name: patientName,
      type: isVideo ? 'video' : 'voice',
      callType: isVideo ? 'video' : 'audio',
      status: 'ringing',
      // Patient's app is closed: the request stays open while they reconnect.
      receiverOffline: Boolean(pickFirst(call.receiverOffline, data.receiverOffline)),
      currentUserId: callerId,
      currentUserType: CALLER_TYPE,
      isIncoming: false,
    },
  };
}

// Server call statuses, grouped as the web VideoCallModal does.
const PENDING = ['pending', 'ringing', 'waiting', 'requested'];
const JOINABLE = ['active', 'accepted', 'connected', 'joined', 'ongoing'];
const TERMINAL = ['rejected', 'cancelled', 'canceled', 'missed', 'ended', 'completed', 'expired', 'failed'];

// 'pending' | 'joinable' | 'terminal' plus the raw status, from
//   GET /api/video/calls/:id/details?userId&userType   (web polls it every
//   1.5s while the patient's phone rings). A 404 means the call expired.
export async function getDirectCallStatus(callId, callerId) {
  try {
    const { data } = await axiosInstance.get(`/api/video/calls/${encodeURIComponent(callId)}/details`, {
      params: { userId: callerId, userType: 'doctor' },
    });
    return classifyStatus(data?.call?.status);
  } catch (error) {
    if (error?.response?.status === 404) return { phase: 'terminal', status: 'expired' };
    const status = classifyStatus(error?.response?.data?.call?.status);
    return status.phase === 'terminal' ? status : { phase: 'unknown', status: '' };
  }
}

const classifyStatus = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (TERMINAL.includes(status)) return { phase: 'terminal', status };
  if (JOINABLE.includes(status)) return { phase: 'joinable', status };
  if (PENDING.includes(status)) return { phase: 'pending', status };
  return { phase: 'unknown', status };
};

// Why a ringing call stopped, for the doctor.
export const endedCallMessage = (status) => ({
  rejected: 'The patient declined the call.',
  missed: 'The patient did not answer.',
  expired: 'The call request expired.',
  cancelled: 'The call was cancelled.',
  canceled: 'The call was cancelled.',
}[status] || 'The call is no longer available.');

// reason: 'ended' once connected, 'cancelled' while still ringing (web endCall).
export async function endDirectCall(callId, callerId, reason = 'ended') {
  try {
    await axiosInstance.put(`/api/video/calls/${encodeURIComponent(callId)}/end`, { userId: callerId, reason });
    return true;
  } catch {
    return false;
  }
}
