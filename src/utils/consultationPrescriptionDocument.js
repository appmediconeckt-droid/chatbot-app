import { prescriptionBrand, prescriptionWatermark } from './prescriptionBrandAssets';
import { PRESCRIPTION_DOCUMENT_CSS } from './prescriptionDocumentCss';
import { consultationData } from './consultationData';
import toImageUri from './imageUri';
import { API_BASE_URL } from '../axiosConfig';
import { formatPhoneNumber } from './countryCodes';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Web prescriptionDate: en-IN "05 Oct 2026", "—" when missing.
export const documentDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

// The booking screen writes "Consultation: In-Clinic Visit at <clinic>.
// Location: <address>" into the appointment notes, and some records carry that
// text in their reason / problem too. It is booking detail, not a complaint or
// a diagnosis, so it is stripped; nothing left means nothing to show.
const clinicalText = value => {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/\bLocation:[\s\S]*$/i, '')
    .replace(/\bConsultation:\s*[^.\n]*?(?:\s+at\s+[^.\n]*)?(?:\.|$)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text && text !== '—' ? text : '';
};

const listText = value => Array.isArray(value) ? value.filter(Boolean).join(', ') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export const approvedSignature = record => {
  const completedVisit = record.source === 'appointment' && record.verificationStatus === 'completed';
  if (record.verificationStatus !== 'verified' && !completedVisit) return '';
  const uri = toImageUri(record.prescriptionSignatureUrl || record.signatureUrl || record.psychiatrist?.prescriptionSignature || record.doctorProfile?.prescriptionSignature || record.doctor?.prescriptionSignature || record.doctorProfile?.prescriptionSignatureUrl || record.psychiatrist?.prescriptionSignatureUrl || record.doctor?.prescriptionSignatureUrl);
  if (!uri || !/^(https?:|data:image\/|\/)/i.test(uri)) return '';
  return uri.startsWith('/') ? `${API_BASE_URL}${uri}` : uri;
};

// Web medicineTiming / medicineDuration (prescriptionDetails.js).
export const medicineTiming = (m = {}) =>
  [listText(m.timeOfDay || m.timings), m.timing || m.when].filter(Boolean).join(' · ');
export const medicineDuration = (m = {}) =>
  m.duration || [m.durationValue, m.durationType].filter(Boolean).join(' ');

// Always short, on the page and in the PDF alike: "RX-" + the last six
// characters of the record id ("RX-99E22E"), the number the app's prescription
// headers show. Ids arrive as "appointment:<id>", "walkin:<id>", "online-<id>"
// …, so the id is picked out of the text rather than the prefix printed. A
// short saved number ("RX-SAVED") is kept as it is.
const SHORT_RX = /^RX-[A-Z0-9]{1,8}$/i;
const shortFrom = (text) => {
  const value = String(text ?? '').trim();
  if (!value) return '';
  if (SHORT_RX.test(value)) return value.toUpperCase();
  const id = value.match(/[a-f\d]{24}/i)?.[0];
  const tail = (id || value.replace(/[^a-z0-9]/gi, '')).slice(-6).toUpperCase();
  return tail ? `RX-${tail}` : '';
};

export const prescriptionNumber = (record = {}) => shortFrom(record.prescriptionNumber || record.prescription_number)
  || shortFrom(record.id || record._id || record.appointmentId);


// Web prescriptionBookingSource: the doctor whose booking QR goes on the
// letterhead, and the QR itself when the record already carries it.
const bookingSource = (record, provider) => {
  const role = String(provider.role || provider.accountType || '').toLowerCase();
  if (role && role !== 'doctor' && provider.accountType !== 'doctor') return { doctorId: '', bookingQr: '' };
  const doctorId = provider._id || provider.id || record.doctorId || record.doctor_id || record.counselor?._id || record.counselor?.id || (typeof record.counselor === 'string' ? record.counselor : '');
  const candidate = provider.profileQrCode || provider.doctorQrCode || record.doctorQrCode || '';
  return {
    doctorId: typeof doctorId === 'object' ? '' : String(doctorId || ''),
    bookingQr: typeof candidate === 'string' && /^data:image\/png;base64,/i.test(candidate) ? candidate : '',
  };
};

// Both raw API records and the doctor's formatted queue rows use this shape.
export const appointmentToDocument = (appointment = {}, doctorName) => {
  const input = { ...appointment.__raw };
  Object.entries(appointment).forEach(([key, value]) => {
    if (value !== undefined && value !== null) input[key] = value;
  });
  const record = consultationData(input);
  const patient = record.patient || record.patientSnapshot || record.patientData || record.user || {};
  const provider = record.doctorProfile || record.psychiatrist || record.doctor || record.psychiatristSnapshot || record.counselor || {};
  const clinic = record.clinic || (typeof record.clinic_id === 'object' ? record.clinic_id : null) || {};
  const candidates = [doctorName, record.psychiatrist?.name, record.psychiatrist?.fullName,
    record.doctorProfile?.fullName, record.doctorProfile?.name, record.doctor?.name, record.doctor?.fullName, record.doctorName, record.doctor_name,
    record.psychiatristSnapshot?.name, record.counselor?.fullName];
  return {
    qualification: listText(provider.qualification),
    specialization: listText(provider.specialization),
    registration: listText(provider.registrationNumber || provider.registration_number || provider.medicalRegistrationNumber || provider.licenseNumber),
    clinic: listText(clinic.clinic_name || clinic.name || record.clinic_name),
    address: listText(clinic.location || clinic.address),
    doctorPhone: formatPhoneNumber(clinic.phone_number || clinic.phoneNumber || clinic.phone || provider.phoneNumber || provider.phone, (clinic.phone_number || clinic.phoneNumber || clinic.phone) ? clinic.phoneCountryCode : provider.phoneCountryCode),
    doctorEmail: listText(provider.email),
    prescriptionId: prescriptionNumber(record),
    ...bookingSource(record, provider),
    opd: listText(record.opdNumber ?? record.token_number ?? record.token),
    patientId: listText(patient.id || patient._id || record.patientId),
    age: listText(patient.age ?? record.age),
    phone: formatPhoneNumber(patient.phoneNumber || patient.phone || patient.mobile || record.phoneNumber || record.phone, patient.phoneCountryCode || record.phoneCountryCode),
    weight: listText(record.vitals?.weight ?? patient.weight ?? patient.medicalInfo?.weight ?? record.weight),
    allergies: listText(patient.allergies || patient.medicalInfo?.allergies || record.allergies),
    signature: approvedSignature(record),
    patient: patient.name || patient.fullName || patient.full_name || record.name || record.patient_name || 'Patient',
    doctor: candidates.find(value => typeof value === 'string' && value.trim() && !/^(dr\.?\s*)?doctor$/i.test(value.trim()))?.trim() || 'Doctor name not recorded',
    date: documentDate(record.issuedAt || record.appointmentDate || record.appointment_date || record.date || record.endTime),
    gender: patient.gender || (record.gender !== 'Not specified' && record.gender) || record.patient_gender || '—',
    issue: clinicalText(record.issue) || clinicalText(record.problem) || '—',
    // Only the doctor's own diagnosis — never the complaint standing in for it.
    diagnosis: clinicalText(record.diagnosis) || '—',
    medicines: record.medicines,
    medicine: record.medicine || '',
    advice: record.advice || record.instructions || '',
    notes: record.additionalNotes || record.additional_notes || '',
    tests: record.recommendedTests,
    followUp: record.followUpDate || record.follow_up_date,
    followUpRequired: [true, 1, '1', 'true'].includes(record.followUpRequired ?? record.follow_up_required),
  };
};

// A doctor prescription built by the patient's Prescriptions screen → the
// web's prescriptionDetails(record, doctorName) shape.
export const doctorRxToDocument = (rx = {}) => {
  const base = appointmentToDocument({
    ...rx,
    patient: rx.patient || rx.patientSnapshot || { name: rx.patientName, gender: rx.patientGender },
    prescriptionNumber: rx.prescriptionNumber || rx.rxNumber,
    token_number: rx.tokenNumber ?? rx.token_number,
    doctorProfile: rx.doctorProfile || rx.psychiatrist || rx.doctor || { fullName: rx.doctorName, qualification: rx.qualification, specialization: rx.specialization },
  });
  const data = { ...base, ...rx.document };
  return {
    ...data,
    clinic: data.clinic || listText(rx.clinic?.name),
    address: data.address || listText(rx.clinic?.location),
    doctorPhone: formatPhoneNumber(data.doctorPhone || rx.clinic?.phone, rx.clinic?.phoneCountryCode),
    phone: formatPhoneNumber(data.phone, rx.patient?.phoneCountryCode || rx.phoneCountryCode),
    opd: data.opd || listText(rx.tokenNumber),
    issue: data.issue === '—' ? clinicalText(rx.complaint) || data.issue : clinicalText(data.issue) || '—',
    tests: data.tests.length ? data.tests : (rx.testDetails || rx.tests || []).map(test => typeof test === 'string' ? { testName: test } : test),
  };
};

// The prescription number, short enough to read out: the backend has no Rx
// number of its own, so the record id ("appointment:6adc…ec8a4") becomes
// "HM-0EC8A4" — its last six characters.
export const shortRxNumber = value => {
  const id = String(value ?? '').replace(/^appointment:/i, '').replace(/[^a-z0-9]/gi, '');
  return id ? `HM-${id.slice(-6).toUpperCase()}` : '';
};

export const followUpText = data =>
  data.followUp
    ? documentDate(data.followUp)
    : data.followUpRequired
      ? 'Required'
      : 'No follow-up scheduled';

export const testLine = test =>
  [
    test.completeBy ? ` / By ${documentDate(test.completeBy)}` : '',
    test.reason ? `\n${test.reason}` : '',
    test.instructions ? `\n${test.instructions}` : '',
  ].join('');

const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// lucide-react icons the web document uses (v1.46, stroke 2), as inline SVG.
// The web's advice icon is hidden by its stylesheet, so it is left out.
const lucide = (children, className = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${className ? ` class="${className}"` : ''} aria-hidden="true">${children}</svg>`;
const STETHOSCOPE = lucide('<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>');
const CALENDAR_DAYS = lucide('<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>', 'prescription-section-icon');

// The PDF page for doctor, receptionist and patient downloads alike: the
// web's PrescriptionDocument.jsx markup with its stylesheet, laid out at the
// web export's fixed 794px paper width (`.prescription-export`), so the app
// prints the same page the web downloads. Like the web PDF, the elements the
// web keeps whole across a page break stay whole here too.
export const buildConsultationDocumentHtml = (data = {}) => {
  const detail = (label, value) => `<div><span>${esc(label)}</span><strong>${esc(value || '-')}</strong></div>`;
  const has = value => Boolean(String(value ?? '').trim());
  const gender = has(data.gender) && data.gender !== '—' ? data.gender : '';
  const ageGender = [has(data.age) && `${data.age} years`, gender].filter(Boolean).join(' / ');
  const weight = has(data.weight) ? `${data.weight}${/kg/i.test(String(data.weight)) ? '' : ' kg'}` : '';
  const medicines = Array.isArray(data.medicines) ? data.medicines : [];
  const tests = Array.isArray(data.tests) ? data.tests : [];
  const advice = String(data.advice || '');
  const adviceLines = advice.split(/\n+/).map(line => line.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
  const contact = [data.doctorPhone, data.doctorEmail].filter(has).join(' | ');
  const hasContactFooter = has(data.address) || Boolean(contact);
  // Height of the footer printed on every page: brand line, plus the address
  // and phone / email lines when there are any (each kept to one line).
  const footerHeight = hasContactFooter ? (has(data.address) && contact ? 70 : 54) : 32;

  const qr = data.bookingQr
    ? `<img src="${esc(data.bookingQr)}" alt="Doctor appointment booking QR"/><span>Scan to book<br/>an appointment</span>`
    : '';

  const medicineSection = medicines.length
    ? `<div class="prescription-table-wrap"><table><thead><tr><th>S. No.</th><th>Medicine name</th><th>Dosage</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${medicines.map((m, index) => `<tr><td>${index + 1}</td><td><strong>${esc(m.name || m.medicine || '-')}</strong></td><td>${esc(m.dosage || '-')}</td><td>${esc(medicineDuration(m) || '-')}</td><td>${esc([medicineTiming(m), m.instructions].filter(Boolean).join(' / ') || '-')}</td></tr>`).join('')}</tbody></table></div>`
    : `<p>${esc(data.medicine || 'No medicines prescribed.')}</p>`;

  const followUp = data.followUp ? documentDate(data.followUp) : data.followUpRequired ? 'Required' : 'No follow-up scheduled';

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=794"/>
<style>
@page { size: A4; margin: 8mm 0 6mm; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
${PRESCRIPTION_DOCUMENT_CSS}
/* Paged layout: the letterhead is the page table's header, which the printer
   repeats at the top of every page; the contact / brand footer is fixed, which
   prints it at the foot of every page, and the page table's footer keeps that
   much room free so content never runs under it. */
.prescription-export .prescription-document { border: 0; padding: 0 26px; min-height: 0; }
.prescription-document table.rx-page { table-layout: auto; font-size: inherit; }
.prescription-document table.rx-page > * > tr > td { padding: 0; border: 0; line-height: inherit; }
.rx-page > thead { display: table-header-group; }
.rx-page > tfoot { display: table-footer-group; }
/* Follow-up and sign-off sit at the foot of the last page, just above the
   footer: the page table is at least one page tall (A4 less the page margins,
   with a millimetre spare so it never spills onto a blank page), and the
   sign-off row takes the spare height with its content aligned to the bottom.
   A longer prescription simply ends with them after the last content. */
.prescription-document table.rx-page { height: 282mm; }
.prescription-document table.rx-page > tbody > tr.rx-signoff-row { height: 100%; }
.prescription-document table.rx-page > tbody > tr.rx-signoff-row > td { vertical-align: bottom; }
.prescription-document table.rx-page > thead > tr > td { padding-bottom: 10px; }
.rx-page .prescription-patient { margin-top: 0; }
.rx-footer-space { height: ${footerHeight + 8}px; }
.prescription-export .prescription-document > .rx-page-footer {
  position: fixed; left: 0; right: 0; bottom: 0; height: ${footerHeight}px; padding: 0 26px;
  display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; background: #fff; z-index: 2;
}
.rx-page-footer .prescription-contact-footer { margin-top: 0; }
.rx-page-footer .prescription-contact-footer p { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prescription-export .prescription-document > .prescription-watermark { position: fixed; top: 50%; }
.prescription-document-header, .prescription-patient-row, .prescription-medicines tr, .prescription-document-footer,
.prescription-tests > p, .prescription-advice li { break-inside: avoid; page-break-inside: avoid; }
.prescription-medicines thead { display: table-header-group; }
/* The signature sits right on the doctor's name: drawn at its own shape and
   bottom-aligned in its box, with no inline-image baseline gap under it. */
.prescription-signature-space { display: flex; align-items: flex-end; justify-content: flex-end; }
.prescription-signature-space img { display: block; width: auto; height: auto; max-width: 145px; max-height: 46px; }
</style></head><body><div class="prescription-export"><article class="prescription-document">
<img class="prescription-watermark" src="${prescriptionWatermark}" alt="" aria-hidden="true"/>
<table class="rx-page"><thead><tr><td>
<header class="prescription-document-header">
<div class="prescription-brand"><img src="${prescriptionBrand}" alt="Humaeli - Talk. Connect. Feel Supported."/>${has(data.clinic) ? `<strong>${esc(data.clinic)}</strong>` : ''}</div>
<div class="prescription-issuer"><span class="prescription-issuer-label">Consulting doctor</span><h2>${esc(data.doctor)}</h2>${has(data.qualification) ? `<p class="prescription-qualification">${esc(data.qualification)}</p>` : ''}${has(data.specialization) ? `<p class="prescription-specialization">${esc(data.specialization)}</p>` : ''}<div class="prescription-doctor-contact">${has(data.registration) ? `<p>${STETHOSCOPE}<span>Reg. No.: ${esc(data.registration)}</span></p>` : ''}</div></div>
<div class="prescription-booking-qr">${qr}</div>
</header>
</td></tr></thead>
<tfoot><tr><td><div class="rx-footer-space"></div></td></tr></tfoot>
<tbody><tr><td>
<section class="prescription-patient" aria-label="Patient and visit details">
<div class="prescription-patient-row">${detail('Patient name', data.patient)}${detail('Date', data.date)}</div>
<div class="prescription-patient-row">${detail('Age / Gender', ageGender)}${detail('OPD / Token No.', data.opd)}</div>
<div class="prescription-patient-row">${detail('Weight', weight)}${detail('Prescription No.', data.prescriptionId)}</div>
<div class="prescription-patient-row prescription-patient-row-wide">${detail('Contact No.', data.phone)}</div>
</section>
<div class="prescription-title"><h3>Consultation Prescription</h3></div>
<section class="prescription-section prescription-clinical"><p><strong>Consultation for: </strong>${esc(data.issue || '—')}</p><p><strong>Diagnosis: </strong>${esc(data.diagnosis || '—')}</p></section>
<section class="prescription-section prescription-medicines" aria-label="Prescribed medicines"><h3>Prescribed Medicines</h3>${medicineSection}</section>
${advice ? `<section class="prescription-section prescription-advice"><div><h3>Advice &amp; Instructions</h3>${adviceLines.length > 1 ? `<ul>${adviceLines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : `<p>${esc(advice)}</p>`}</div></section>` : ''}
${tests.length ? `<section class="prescription-section prescription-tests"><h3>Recommended tests</h3>${tests.map(test => `<p><strong>${esc(test.testName || test.name)}</strong>${esc(testLine(test))}</p>`).join('')}</section>` : ''}
</td></tr>
<tr class="rx-signoff-row"><td>
<footer class="prescription-document-footer"><div class="prescription-followup">${CALENDAR_DAYS}<div><span>Next Follow-up:</span><strong>${esc(followUp)}</strong></div></div><div class="prescription-signoff"><div class="prescription-signature-space">${data.signature ? `<img src="${esc(data.signature)}" alt="Doctor signature"/>` : ''}</div><strong>${esc(data.doctor)}</strong>${has(data.qualification) ? `<p>${esc(data.qualification)}</p>` : ''}${has(data.registration) ? `<p>Reg. No.: ${esc(data.registration)}</p>` : ''}</div></footer>
</td></tr></tbody></table>
<div class="rx-page-footer">
${hasContactFooter ? `<div class="prescription-contact-footer">${has(data.address) ? `<p>${esc(data.address)}</p>` : ''}<p>${esc(contact)}</p></div>` : ''}
<div class="prescription-brand-footer"><span>This prescription is provided by</span><div><img src="${prescriptionWatermark}" alt="" aria-hidden="true"/><strong>HUMAELI</strong></div><span>Talk. Connect. Feel Supported.</span></div>
</div>
</article></div></body></html>`;
};
