import axiosInstance from '../src/axiosConfig';
import { socketService } from '../src/services/socketService';
import { endDirectCall, endedCallMessage, getDirectCallStatus, startDirectCall } from '../src/features/doctor/dashboard/api/doctorCalls';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(key === 'userData' ? JSON.stringify({ _id: 'doc-1' }) : null)),
}));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn(), put: jest.fn(), get: jest.fn() } }));
jest.mock('../src/services/socketService', () => ({ socketService: { connect: jest.fn() } }));
jest.mock('../src/features/doctor/dashboard/api/doctorAppointments', () => ({
  pickFirst: (...values) => values.find((v) => v !== undefined && v !== null && v !== ''),
}));
jest.mock('../src/utils/callRequestStatus', () => ({
  isNotificationOnlyCallResponse: (data) => Boolean(data?.notificationOnly),
  getNotificationOnlyCallMessage: (_data, name) => `${name} was notified.`,
}));

describe('doctor direct calls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketService.connect.mockResolvedValue({ id: 'doctor-socket' });
  });

  it.each([['video', 'video', 'video'], ['voice', 'voice', 'audio']])(
    'starts a %s call like the web: socket first, then the request with its id',
    async (mode, sentType, modalType) => {
      axiosInstance.post.mockResolvedValue({ data: { success: true, callId: 'c1', streamCallId: 'room-1' } });
      const result = await startDirectCall({ patientId: 'pat-9', patientName: 'Asha', mode });
      expect(socketService.connect).toHaveBeenCalled();
      expect(axiosInstance.post).toHaveBeenCalledWith(
        '/api/video/calls/initiate',
        { receiverId: 'pat-9', receiverType: 'user', callType: sentType, socketId: 'doctor-socket' },
        { timeout: 20000 },
      );
      // The Stream room is the call id, as on the web — not the server's separate room id.
      expect(result).toMatchObject({ callerId: 'doc-1', callData: { callId: 'c1', roomId: 'c1', streamCallId: 'c1', callType: modalType, isIncoming: false } });
    },
  );

  it('does not send the request without a connected socket', async () => {
    socketService.connect.mockResolvedValue({ id: null });
    await expect(startDirectCall({ patientId: 'pat-9', mode: 'video' })).rejects.toThrow(/not ready/);
    socketService.connect.mockRejectedValue(new Error('offline'));
    await expect(startDirectCall({ patientId: 'pat-9', mode: 'video' })).rejects.toThrow(/Could not connect/);
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('reads the call from a `data` object and keeps a pending request for an offline patient', async () => {
    axiosInstance.post.mockResolvedValue({ data: { success: true, data: { id: 'c2', status: 'pending', receiverOffline: true } } });
    const result = await startDirectCall({ patientId: 'pat-9', mode: 'video' });
    expect(result.callData).toMatchObject({ callId: 'c2', receiverOffline: true });
  });

  it('carries on with a call that is already pending after a lost answer', async () => {
    axiosInstance.post.mockRejectedValue({ response: { status: 409, data: { callId: 'c3', status: 'pending' } } });
    const result = await startDirectCall({ patientId: 'pat-9', mode: 'video' });
    expect(result.callData.callId).toBe('c3');
  });

  it('stops on an explicit failure or an answer without a call id', async () => {
    axiosInstance.post.mockResolvedValue({ data: { success: false, error: 'Patient unavailable' } });
    await expect(startDirectCall({ patientId: 'pat-9', mode: 'video' })).rejects.toThrow('Patient unavailable');
    axiosInstance.post.mockResolvedValue({ data: { success: true } });
    await expect(startDirectCall({ patientId: 'pat-9', mode: 'video' })).rejects.toThrow(/could not be started/);
  });

  it('ends the call like the web: cancelled while ringing, ended once connected', async () => {
    axiosInstance.put.mockResolvedValue({ data: {} });
    await expect(endDirectCall('c1', 'doc-1')).resolves.toBe(true);
    expect(axiosInstance.put).toHaveBeenCalledWith('/api/video/calls/c1/end', { userId: 'doc-1', reason: 'ended' });
    await endDirectCall('c1', 'doc-1', 'cancelled');
    expect(axiosInstance.put).toHaveBeenLastCalledWith('/api/video/calls/c1/end', { userId: 'doc-1', reason: 'cancelled' });
  });

  it('reads the ringing call status like the web call screen', async () => {
    axiosInstance.get.mockResolvedValue({ data: { call: { status: 'pending' } } });
    await expect(getDirectCallStatus('c1', 'doc-1')).resolves.toEqual({ phase: 'pending', status: 'pending' });
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/video/calls/c1/details', { params: { userId: 'doc-1', userType: 'doctor' } });
    axiosInstance.get.mockResolvedValue({ data: { call: { status: 'accepted' } } });
    await expect(getDirectCallStatus('c1', 'doc-1')).resolves.toMatchObject({ phase: 'joinable' });
    axiosInstance.get.mockResolvedValue({ data: { call: { status: 'rejected' } } });
    await expect(getDirectCallStatus('c1', 'doc-1')).resolves.toEqual({ phase: 'terminal', status: 'rejected' });
    expect(endedCallMessage('rejected')).toMatch(/declined/);
    axiosInstance.get.mockRejectedValue({ response: { status: 404 } });
    await expect(getDirectCallStatus('c1', 'doc-1')).resolves.toEqual({ phase: 'terminal', status: 'expired' });
    axiosInstance.get.mockRejectedValue(new Error('Network Error'));
    await expect(getDirectCallStatus('c1', 'doc-1')).resolves.toMatchObject({ phase: 'unknown' });
  });
});
