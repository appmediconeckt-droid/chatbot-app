// Reads a doctor's walk-in QR code.
//
// The doctor app / web dashboard encode
//   https://<web origin>/walk-in-appointment?doctorId=<id>&source=qr
// (see DoctorProfileQrScreen / web AllQRcode). The origin varies by
// environment, so only the path and query are checked. Parsed by hand: the
// URL polyfill in React Native doesn't reliably support searchParams.
export const parseWalkInQr = (value) => {
  const text = String(value || '').trim();
  const match = /\/walk-in-appointment\/?\?([^#\s]*)/i.exec(text);
  if (!match) return null;

  const params = {};
  match[1].split('&').forEach((pair) => {
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) return;
    try {
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      // ignore a malformed pair
    }
  });

  const doctorId = String(params.doctorId || params.doctor_id || '').trim();
  if (!doctorId) return null;
  return { doctorId, source: String(params.source || '').toLowerCase() === 'qr' ? 'qr' : 'direct' };
};
