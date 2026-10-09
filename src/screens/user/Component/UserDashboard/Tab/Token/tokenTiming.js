// Same live-timing helpers as the web (Tab/Counselor/tokenTiming.js).
// The backend rounds timing differences to whole minutes. Round clock cards
// the same way so 14:15 + 4 min late displays 14:19, even for a 14:18:40 ETA.
// This changes presentation only; actual and estimated timestamps stay intact.
export const getTokenDisplayTime = (value) => {
  if (value == null || value === '') return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(Math.round(timestamp / 60000) * 60000) : null;
};

export const formatQueueStatus = (value) => String(value || '').replace(/[_-]+/g, ' ').trim() || '--';

export const formatTimer = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return "--";
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
};

export const formatWaitLabel = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return '--';
  const value = Math.max(0, Math.ceil(seconds));
  if (value < 60) return '< 1 min';
  return `${Math.ceil(value / 60)} min`;
};

export const getLiveTokenTiming = (current = {}, queue = {}, now = Date.now()) => {
  const snapshot = Date.parse(current.serverTime);
  const doctorStatus = String(current.doctorStatus || '').toLowerCase();
  const tick = doctorStatus === "consulting" && Number.isFinite(snapshot) ? Math.max(0, Math.floor((now - snapshot) / 1000)) : 0;
  const elapsed = current.elapsedSeconds == null ? null : current.elapsedSeconds + tick;
  const eta = Date.parse(queue.estimatedTurnTime);
  const canShowWaiting = ['consulting', 'waiting'].includes(doctorStatus) && !queue.estimateUncertain;
  const waiting = canShowWaiting && !current.isYourTurn && Number.isFinite(eta)
    ? Math.max(0, Math.ceil((eta - now) / 1000)) : null;
  // If the server snapshot expires while another consultation continues, hide
  // the countdown until polling refreshes the estimate instead of promising zero.
  return { elapsed, waiting: doctorStatus === 'consulting' && waiting === 0 ? null : waiting };
};
