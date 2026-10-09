// Prints a doctor's prescription (one visit, as built by the patient's
// Prescriptions screen) through the native PrescriptionPrint module, which
// opens Android's print dialog — a printer or "Save as PDF".
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import HUMAELI_LOGO from './humaeliLogoDataUri';

const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const consultationLabel = mode => {
  const value = String(mode || '').toLowerCase();
  if (value.includes('video')) return 'Video';
  if (value.includes('voice') || value.includes('phone')) return 'Voice';
  return 'In-clinic';
};

const section = (title, body) =>
  body ? `<div class="section"><div class="label">${title}</div>${body}</div>` : '';

export const buildPrescriptionHtml = rx => {
  const clinicName = rx.clinic?.name || 'Humaeli Health';
  const medicines = rx.medicines || [];
  const medicineRows = medicines.length
    ? medicines
        .map(
          (m, i) => `<tr>
            <td class="num">${i + 1}</td>
            <td class="med">${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.dosage) || '—'}</td>
            <td>${(m.timings || []).map(t => `<span class="chip">${escapeHtml(t)}</span>`).join(' ') || '—'}</td>
            <td>${escapeHtml(m.duration) || '—'}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="empty">No medicines prescribed.</td></tr>';

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12.5px; }
  .head { background: linear-gradient(90deg, #006B2C, #01CE54); color: #fff; border-radius: 12px;
          padding: 16px 18px; display: flex; align-items: center; gap: 14px; }
  .mono { width: 58px; height: 58px; border-radius: 14px; background: #fff;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .mono img { width: 48px; height: 48px; }
  .brand { font-size: 10px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; opacity: .9; }
  .watermark { position: fixed; top: 42%; left: 50%; width: 300px; height: 300px; margin: -150px 0 0 -150px;
               opacity: .05; z-index: -1; }
  .clinic { flex: 1; }
  .clinic h1 { margin: 0; font-size: 21px; letter-spacing: .3px; }
  .clinic div { opacity: .92; margin-top: 3px; font-size: 12px; }
  .rxtag { text-align: right; font-size: 11px; opacity: .95; }
  .rxtag b { display: block; font-size: 15px; letter-spacing: 1.5px; }
  .doctor { display: flex; justify-content: space-between; align-items: flex-end; padding: 14px 4px 10px; }
  .doctor h2 { margin: 0; font-size: 17px; }
  .doctor .spec { color: #64748b; margin-top: 2px; }
  .role { border: 1px solid #006B2C; color: #006B2C; border-radius: 999px; padding: 3px 10px;
          font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
  .rule { border-top: 2px solid #006B2C; border-bottom: 1px solid #006B2C; height: 4px; margin-bottom: 12px; }
  .info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f0fdf4;
          border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 12px; }
  .info span { display: block; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
  .info b { font-size: 13px; }
  .section { margin-top: 14px; }
  .label { color: #006B2C; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 5px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 11px; line-height: 1.5; }
  .dx { background: #f0fdf4; border-color: #bbf7d0; font-weight: 800; font-size: 13.5px; }
  .rx { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
  .rx .sym { font-size: 38px; font-weight: 900; font-style: italic; color: #006B2C; line-height: 1; }
  .rx h3 { margin: 0; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #006B2C; color: #fff; text-align: left; font-size: 10.5px; text-transform: uppercase;
       letter-spacing: .4px; padding: 7px 8px; }
  td { border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  td.num { width: 26px; color: #006B2C; font-weight: 900; }
  td.med { font-weight: 800; }
  td.empty { color: #94a3b8; text-align: center; }
  .chip { display: inline-block; border: 1px solid #bbf7d0; color: #006B2C; border-radius: 999px;
          padding: 1px 7px; font-size: 10.5px; font-weight: 700; margin: 1px 0; }
  .follow { margin-top: 16px; display: flex; justify-content: space-between; align-items: center;
            border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 10px; padding: 10px 14px; }
  .follow b { font-size: 15px; }
  .foot { margin-top: 34px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sign { text-align: center; min-width: 190px; }
  .sign .name { color: #006B2C; font-style: italic; font-weight: 700; font-size: 15px; }
  .sign .line { border-top: 1px solid #94a3b8; margin-top: 4px; padding-top: 3px; color: #64748b; font-size: 10.5px; }
  .issued { color: #16a34a; font-weight: 800; font-size: 11px; }
  .note { margin-top: 14px; color: #64748b; font-size: 10.5px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
</style></head><body>
  <img class="watermark" src="${HUMAELI_LOGO}" alt=""/>
  <div class="head">
    <div class="mono"><img src="${HUMAELI_LOGO}" alt="Humaeli"/></div>
    <div class="clinic">
      <div class="brand">Humaeli</div>
      <h1>${escapeHtml(clinicName)}</h1>
      ${rx.clinic?.location ? `<div>📍 ${escapeHtml(rx.clinic.location)}</div>` : '<div>Digital Prescription</div>'}
      ${rx.clinic?.phone ? `<div>📞 ${escapeHtml(rx.clinic.phone)}</div>` : ''}
    </div>
    <div class="rxtag"><b>PRESCRIPTION</b>${rx.rxNumber ? escapeHtml(rx.rxNumber) : ''}</div>
  </div>

  <div class="doctor">
    <div><h2>${escapeHtml(rx.doctorName)}</h2><div class="spec">${escapeHtml(rx.specialization)}</div></div>
    <div class="role">${rx.kind === 'psychiatrist' ? 'Psychiatrist' : 'Doctor'}</div>
  </div>
  <div class="rule"></div>

  <div class="info">
    <div><span>Patient</span><b>${escapeHtml(rx.patientName) || '—'}</b></div>
    <div><span>Date</span><b>${formatDate(rx.date)}</b></div>
    <div><span>Consultation</span><b>${consultationLabel(rx.consultationMode)}</b></div>
    <div><span>Token</span><b>${rx.tokenNumber ? `#${escapeHtml(rx.tokenNumber)}` : '—'}</b></div>
  </div>

  ${section('Complaint', rx.complaint ? `<div class="box">${escapeHtml(rx.complaint)}</div>` : '')}
  ${section('Diagnosis', rx.diagnosis ? `<div class="box dx">${escapeHtml(rx.diagnosis)}</div>` : '')}

  <div class="rx"><div class="sym">℞</div><h3>Medicines (${medicines.length})</h3></div>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Timing</th><th>Duration</th></tr></thead>
    <tbody>${medicineRows}</tbody>
  </table>

  ${section('Advice', rx.advice ? `<div class="box">${escapeHtml(rx.advice)}</div>` : '')}
  ${section('Recommended tests', (rx.tests || []).length ? `<div class="box">${rx.tests.map(escapeHtml).join(', ')}</div>` : '')}
  ${section("Doctor's notes", rx.additionalNotes ? `<div class="box">${escapeHtml(rx.additionalNotes)}</div>` : '')}

  ${rx.followUpDate ? `<div class="follow"><span>Follow-up visit</span><b>${formatDate(rx.followUpDate)}</b></div>` : ''}

  <div class="foot">
    <div class="issued"><img src="${HUMAELI_LOGO}" alt="" style="width:18px;height:18px;vertical-align:middle;margin-right:5px"/>Digitally issued by Humaeli</div>
    <div class="sign"><div class="name">${escapeHtml(rx.doctorName)}</div><div class="line">Signature</div></div>
  </div>
  <div class="note">Take medicines only as prescribed. Contact your doctor if symptoms get worse.</div>
</body></html>`;
};

const unavailable = () => {
  const error = new Error('This needs the latest app version.');
  error.code = 'PRINT_UNAVAILABLE';
  return error;
};

const documentName = rx =>
  `Prescription ${rx.doctorName || ''} ${formatDate(rx.date)}`.replace(/\s+/g, ' ').trim();

// Builds the prescription as an A4 PDF and opens the share sheet with it
// (WhatsApp, Gmail, Drive, Files…). Rejects with code 'PRINT_UNAVAILABLE'
// when the installed app predates the native module (needs a rebuild).
export const sharePrescriptionPdf = async rx => {
  const pdf = NativeModules.PrescriptionPrint;
  if (!pdf?.createPdf || !pdf?.sharePdf) throw unavailable();
  const name = documentName(rx);
  const path = await pdf.createPdf(buildPrescriptionHtml(rx), name);
  return pdf.sharePdf(path, name);
};

// Builds the prescription PDF and saves it straight into the phone's public
// Downloads folder. Resolves { path, cachePath }: `path` is the Downloads copy,
// `cachePath` the app copy that PdfFileOpener can open (FileProvider only
// covers app storage).
export const downloadPrescriptionPdf = async rx => {
  const pdf = NativeModules.PrescriptionPrint;
  if (!pdf?.createPdf) throw unavailable();
  const name = documentName(rx);
  const cachePath = await pdf.createPdf(buildPrescriptionHtml(rx), name);

  // Android 10+ lets apps create files in Downloads without a permission.
  if (Platform.OS === 'android' && Platform.Version < 29) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Storage permission is needed to download the PDF.');
    }
  }

  const baseName = name.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Prescription';
  const folder = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  let path = `${folder}/${baseName}.pdf`;
  for (let copy = 1; (await RNFS.exists(path)) && copy < 100; copy += 1) {
    path = `${folder}/${baseName} (${copy}).pdf`;
  }
  await RNFS.copyFile(cachePath, path);
  if (Platform.OS === 'android') await RNFS.scanFile(path).catch(() => {});
  return { path, cachePath };
};

// Android print dialog (printer or "Save as PDF").
export const printPrescription = async rx => {
  const printer = NativeModules.PrescriptionPrint;
  if (!printer?.printHtml) throw unavailable();
  return printer.printHtml(buildPrescriptionHtml(rx), documentName(rx));
};
