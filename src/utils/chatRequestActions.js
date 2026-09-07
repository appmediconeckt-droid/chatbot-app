import axiosInstance from '../axiosConfig';

export const getChatRequestId = (request) => {
  const value =
    request?.chatId ||
    request?.id ||
    request?._id ||
    request?.chat?._id ||
    request?.chat?.id ||
    request?.chat?.chatId;

  return value ? String(value).trim() : '';
};

export const respondToChatRequest = async (request, action) => {
  const normalizedAction = action === 'accept' ? 'accept' : 'reject';
  const chatId = getChatRequestId(request);

  if (!chatId) {
    throw new Error('Missing chat request ID');
  }

  const body = normalizedAction === 'reject'
    ? { reason: 'declined' }
    : {};

  const response = await axiosInstance.patch(
    `/api/chat/${normalizedAction}/${chatId}`,
    body,
  );

  if (response.data?.success === false) {
    throw new Error(response.data?.message || response.data?.error || 'Request update failed');
  }

  return response.data;
};
