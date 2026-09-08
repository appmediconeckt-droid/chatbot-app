export const isNotificationOnlyCallResponse = (responseData = {}) => {
  const callData = responseData?.callData || {};
  const status = String(responseData?.status || callData?.status || '')
    .trim()
    .toLowerCase();
  const presentation = String(responseData?.presentation || callData?.presentation || '')
    .trim()
    .toLowerCase();

  return (
    responseData?.queued === true ||
    responseData?.notificationOnly === true ||
    responseData?.receiverOffline === true ||
    responseData?.initiatorOffline === true ||
    status === 'notification_only' ||
    presentation === 'notification_only'
  );
};

export const getNotificationOnlyCallMessage = (
  responseData = {},
  fallbackName = 'the other person',
) => {
  if (responseData?.message) return responseData.message;

  const receiverName =
    responseData?.callData?.receiver?.displayName ||
    responseData?.callData?.receiver?.fullName ||
    fallbackName;

  if (responseData?.initiatorOffline) {
    return 'You need to be online before starting a call. A notification was sent instead.';
  }

  return `${receiverName} is offline. A notification was sent instead of starting the call.`;
};
