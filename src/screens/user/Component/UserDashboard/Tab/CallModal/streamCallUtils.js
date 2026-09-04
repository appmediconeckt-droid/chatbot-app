const STREAM_CALL_TYPE = 'default';
const STREAM_JOIN_RETRY_MS = 5000;
const STREAM_JOIN_RETRY_DELAY_MS = 350;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const normalizeStreamCallId = (value) => {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'object'
    ? value.id || value._id || value.callId || value.roomId || value.cid
    : value;
  const id = String(raw || '').trim();
  if (!id) return null;
  return id.startsWith(`${STREAM_CALL_TYPE}:`)
    ? id.slice(`${STREAM_CALL_TYPE}:`.length)
    : id;
};

export const getStreamCallIdCandidates = (callData) => {
  const apiCall = callData?.apiCallData || {};
  return [
    callData?.streamCallId,
    callData?.stream_call_id,
    callData?.streamId,
    callData?.roomId,
    callData?.room_id,
    callData?.channelId,
    apiCall?.streamCallId,
    apiCall?.stream_call_id,
    apiCall?.streamId,
    apiCall?.roomId,
    apiCall?.room_id,
    apiCall?.channelId,
    apiCall?.callId,
    apiCall?.id,
    apiCall?._id,
    callData?.callId,
    callData?.id,
  ].map(normalizeStreamCallId).filter((id, index, ids) => id && ids.indexOf(id) === index);
};

export const joinStreamCall = async ({
  streamClient,
  callData,
  CallingState,
  disableCamera = false,
}) => {
  const streamCallIds = getStreamCallIdCandidates(callData);
  if (streamCallIds.length === 0) throw new Error('Missing Stream call id');

  const isIncoming = callData?.isIncoming === true;
  const deadline = Date.now() + (isIncoming ? STREAM_JOIN_RETRY_MS : 0);
  let lastJoinError = null;

  do {
    for (const streamCallId of streamCallIds) {
      const candidateCall = streamClient.call(STREAM_CALL_TYPE, streamCallId);

      if (disableCamera) {
        await candidateCall.camera.disable().catch(() => {});
      }

      const currentState = candidateCall.state?.callingState;
      const alreadyJoined =
        currentState === CallingState.JOINED ||
        currentState === CallingState.JOINING;

      try {
        if (!alreadyJoined) {
          await candidateCall.join({ create: !isIncoming });
        }
        return candidateCall;
      } catch (joinError) {
        lastJoinError = joinError;
        try { await candidateCall.leave(); } catch (_) {}
      }
    }

    if (!isIncoming || Date.now() >= deadline) break;
    await wait(STREAM_JOIN_RETRY_DELAY_MS);
  } while (Date.now() < deadline);

  if (isIncoming) {
    const fallbackCall = streamClient.call(STREAM_CALL_TYPE, streamCallIds[0]);
    if (disableCamera) {
      await fallbackCall.camera.disable().catch(() => {});
    }
    try {
      await fallbackCall.join({ create: true });
      return fallbackCall;
    } catch (joinError) {
      lastJoinError = joinError;
      try { await fallbackCall.leave(); } catch (_) {}
    }
  }

  throw lastJoinError || new Error('Failed to join Stream call');
};
