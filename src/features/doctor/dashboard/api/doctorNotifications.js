// Doctor in-app notifications: the list behind the header bell and the
// Notifications screen (GET /api/notifications), plus live updates from the
// socket. The server's event name varies, so the same four names the patient
// dashboard's bell listens to are subscribed here.
import axiosInstance from '../../../../axiosConfig';
import socketService from '../../../../services/socketService';

export const NEW_NOTIFICATION_EVENTS = ['notification', 'new-notification', 'notification:new', 'notification-new'];

export const unwrapNotificationList = (payload) => (
  Array.isArray(payload) ? payload
    : Array.isArray(payload?.notifications) ? payload.notifications
      : Array.isArray(payload?.data) ? payload.data
        : []
);

export const fetchNotificationList = async () => {
  const res = await axiosInstance.get('/api/notifications');
  return unwrapNotificationList(res.data);
};

// Calls `onNew(payload)` for every live notification. Returns an unsubscribe
// function; safe to call before the socket has connected.
export const subscribeToNewNotifications = (onNew) => {
  let active = true;
  const offs = [];
  (async () => {
    for (const event of NEW_NOTIFICATION_EVENTS) {
      try {
        const off = await socketService.on(event, (payload) => { if (active) onNew(payload); });
        if (active) offs.push(off);
        else off?.();
      } catch { /* socket optional: the list still loads over HTTP */ }
    }
  })();
  return () => {
    active = false;
    offs.forEach((off) => { try { off?.(); } catch { /* ignore */ } });
  };
};
