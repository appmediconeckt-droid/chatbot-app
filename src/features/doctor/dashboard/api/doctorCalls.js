// Direct video / voice calls from the doctor dashboard — no chat screen.
//
// The call API doesn't need a chat: POST /api/video/calls/initiate takes the
// caller, the patient's user id and the call type. The request body, the
// room-id lookup and the end-call request mirror the chat screen
// (counselor-dashboard/Tab/SMSInput) that the dashboard used to route through,
// including initiatorType 'counsellor', which is what doctor calls have always
// sent to the backend.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../../../axiosConfig';
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

const getStreamRoomId = (...sources) => {
  for (const source of sources) {
    const roomId = pickFirst(
      source?.streamCallId, source?.stream_call_id, source?.streamId, source?.roomId, source?.room_id,
      source?.channelId, source?.call?.streamCallId, source?.call?.roomId,
      source?.data?.streamCallId, source?.data?.roomId,
      source?.callData?.streamCallId, source?.callData?.roomId,
    );
    if (roomId) return roomId;
  }
  return '';
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

  const { data } = await axiosInstance.post('/api/video/calls/initiate', {
    initiatorId: callerId,
    receiverId: String(patientId),
    receiverType: 'user',
    callType: isVideo ? 'video' : 'audio',
    initiatorType: CALLER_TYPE,
  });
  if (!data?.success) throw new Error(data?.message || 'Call could not be started.');

  if (isNotificationOnlyCallResponse(data)) {
    return { notificationOnly: true, message: getNotificationOnlyCallMessage(data, patientName || 'The patient') };
  }

  const roomId = getStreamRoomId(data, data.callData);
  return {
    callerId,
    callData: {
      callId: data.callId || data.callData?._id,
      roomId,
      streamCallId: roomId,
      name: patientName,
      type: isVideo ? 'video' : 'voice',
      callType: isVideo ? 'video' : 'audio',
      status: 'ringing',
      currentUserId: callerId,
      currentUserType: CALLER_TYPE,
      isIncoming: false,
    },
  };
}

export async function endDirectCall(callId, callerId) {
  try {
    await axiosInstance.put(`/api/video/calls/${callId}/end`, { userId: callerId, endedBy: CALLER_TYPE });
    return true;
  } catch {
    return false;
  }
}
