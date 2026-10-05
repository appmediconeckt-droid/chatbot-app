// Reads a doctor's walk-in QR code.
//
// The doctor app / web dashboard encode
//   https://<web origin>/walk-in-appointment?doctorId=<id>&source=qr
// (see DoctorProfileQrScreen / web AllQRcode). The origin varies by
// environment, so only the path and query are checked. Parsed by hand: the
// URL polyfill in React Native doesn't reliably support searchParams.
export const parseWalkInQr = (value) => {
  const text = String(value || '').trim();

  // Clinic walk-in QR from the server / web (Settings → QR, Clinic Settings):
  //   https://<web origin>/walkin/<doctorClinicId>
  // It names the doctor-clinic link, not the doctor — the caller resolves it
  // through GET /api/qr/walkin/:doctorClinicId.
  const clinicWalkin = /\/walkin\/([A-Za-z0-9_-]+)\/?(?:[?#]|$)/i.exec(text);
  if (clinicWalkin) return { doctorClinicId: decodeURIComponent(clinicWalkin[1]), source: 'qr' };

  // The server's doctor QR image encodes JSON: {"type":"doctor","id":"…",…}.
  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text);
      const id = data?.doctorId || data?.id;
      if (id && (String(data?.type || data?.qrType || '').toLowerCase().includes('doctor'))) {
        return { doctorId: String(id), source: 'qr' };
      }
    } catch {
      // not JSON — fall through to the URL formats
    }
  }

  // The doctor's profile QR: https://<web origin>/doctor/<doctorId>
  // (DoctorProfileQrScreen / server profileQrUrl). Opens the same doctor screen.
  const profile = /\/doctor\/([A-Za-z0-9_-]+)\/?(?:[?#]|$)/i.exec(text);
  if (profile) return { doctorId: decodeURIComponent(profile[1]), source: 'qr' };

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
  // Clinic-wise booking QR (doctor sidebar → QR Code) also names the clinic.
  const clinicId = String(params.clinicId || params.clinic_id || '').trim() || null;
  return { doctorId, clinicId, source: String(params.source || '').toLowerCase() === 'qr' ? 'qr' : 'direct' };
};
