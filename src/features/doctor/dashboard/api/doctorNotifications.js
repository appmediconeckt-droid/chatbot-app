// Doctor in-app notifications: the list behind the header bell and the
// Notifications screen (GET /api/notifications), plus live updates from the
// socket. The server's event name varies, so the same four names the patient
// dashboard's bell listens to are subscribed here.
import axiosInstance from '../../../../axiosConfig';
import socketService from '../../../../services/socketService';
import { realNameNotificationText } from './doctorAppointments';

// The doctor screen a notification opens: 'appointment' (that appointment in
// the Appointments list), 'earnings', 'reviews', 'followUps',
// 'staffManagement', 'calendar', or null (stay on the list). Read from the
// type, the web action URL and the title; a payment about an appointment
// still opens Earnings.
export const doctorNotificationTarget = ({ type, actionUrl, title, appointmentId } = {}) => {
  const text = `${type || ''} ${actionUrl || ''} ${title || ''}`.toLowerCase();
  if (/follow[\s_-]?up/.test(text)) return 'followUps';
  if (/payment|earning|wallet|payout|settle|transaction|refund/.test(text)) return 'earnings';
  if (/review|rating|rated/.test(text)) return 'reviews';
  if (/staff|receptionist/.test(text)) return 'staffManagement';
  if (/availability|calendar|slot|leave/.test(text)) return 'calendar';
  if (appointmentId || /appointment|booking|emergency|queue|consult|walk[\s_-]?in|cancel/.test(text)) return 'appointment';
  return null;
};

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

// Cards (see NotificationsScreen) about an appointment name the patient by
// their real name instead of the anonymous one the server wrote.
export const withRealPatientNames = (cards) => Promise.all(cards.map(async (card) => {
  if (!card.appointmentId) return card;
  const { title, body } = await realNameNotificationText(card.appointmentId, { title: card.title, body: card.body });
  return { ...card, title, body };
}));

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
