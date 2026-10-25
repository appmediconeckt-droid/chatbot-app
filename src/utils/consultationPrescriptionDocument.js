import { prescriptionBrand, prescriptionWatermark, prescriptionFooter } from './prescriptionBrandAssets';
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
    prescriptionId: listText(record.prescriptionNumber || record.id || record._id),
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
    issue: record.issue || record.problem || '—',
    diagnosis: record.diagnosis || record.problem || '—',
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
    issue: data.issue === '—' ? rx.complaint || data.issue : data.issue,
    tests: data.tests.length ? data.tests : (rx.testDetails || rx.tests || []).map(test => typeof test === 'string' ? { testName: test } : test),
  };
};

export const followUpText = data =>
  data.followUp
    ? documentDate(data.followUp)
    : data.followUpRequired
      ? 'Required'
      : 'No follow-up scheduled';

export const testLine = test =>
  [
    test.completeBy ? ` · By ${documentDate(test.completeBy)}` : '',
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

// Shared by patient downloads and staff/doctor native PDF printing: one A4
// page laid out like the in-app prescription — compact letterhead, patient
// strip, clinical notes, medicines table, follow-up and sign-off.
export const buildConsultationDocumentHtml = (data = {}) => {
  // Blank values and "—" / "not recorded" fillers are never printed.
  const present = value => {
    const text = String(value ?? '').trim();
    return Boolean(text) && text !== '—' && !/^(none|not)\s*recorded$/i.test(text);
  };
  const ref = (label, value) => present(value) ? `<div class="ref"><span>${esc(label)}</span><b>${esc(value)}</b></div>` : '';
  const info = (label, value) => present(value) ? `<div class="info"><span>${esc(label)}</span><b>${esc(value)}</b></div>` : '';
  const block = (title, value) => present(value) ? `<section class="block"><h3>${esc(title)}</h3><p>${esc(value)}</p></section>` : '';
  const cell = value => present(value) ? esc(value) : '<i>—</i>';

  const doctorLines = [data.qualification, data.specialization, data.registration && `Reg. No.: ${data.registration}`].filter(present);
  const clinicLine = [data.clinic, data.address].filter(present).map(esc).join(' &nbsp;·&nbsp; ');
  const contactLine = [data.doctorPhone, data.doctorEmail].filter(present).map(esc).join(' &nbsp;·&nbsp; ');
  const rxNumber = present(data.prescriptionId) ? String(data.prescriptionId).replace(/^appointment:/i, '') : '';
  const ageGender = [present(data.age) && `${data.age} yrs`, present(data.gender) && data.gender].filter(Boolean).join(' / ');
  const weight = present(data.weight) ? `${data.weight}${/kg/i.test(data.weight) ? '' : ' kg'}` : '';
  const followUp = followUpText(data);
  const hasFollowUp = followUp !== 'No follow-up scheduled';

  const medicines = (data.medicines || []).length
    ? `<table><thead><tr><th class="n">#</th><th class="name">Medicine</th><th>Dosage</th><th>When</th><th>Duration</th><th class="notes">Instructions</th></tr></thead><tbody>${data.medicines.map((m, index) => `<tr><td class="n">${index + 1}</td><td class="name"><b>${esc(m.name || m.medicine || '—')}</b>${present(m.strength) ? `<small>${esc(m.strength)}</small>` : ''}</td><td>${cell(m.dosage)}</td><td>${cell(medicineTiming(m))}</td><td>${cell(medicineDuration(m))}</td><td class="notes">${cell(m.instructions)}</td></tr>`).join('')}</tbody></table>`
    : `<p class="empty">${esc(present(data.medicine) ? data.medicine : 'No medicines prescribed.')}</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
@page { size: A4; margin: 10mm 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 11.5px/1.45 Arial, Helvetica, sans-serif; color: #1f2d3a; }
/* A column, so the sign-off and brand line sit at the foot of the page. */
.doc { position: relative; display: flex; flex-direction: column; min-height: 270mm; padding-bottom: 14px; border-bottom: 4px solid #0f766e; }
b { font-weight: 700; overflow-wrap: anywhere; }
p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
span { display: block; font-size: 8.5px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: #64748b; }
/* Letterhead */
.head { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; border-bottom: 2px solid #99d6cf; }
.logo { width: 62px; height: 62px; object-fit: contain; flex-shrink: 0; }
.doctor { flex: 1; min-width: 0; }
.doctor h2 { margin: 1px 0 2px; font-size: 18px; color: #193d42; }
.doctor p { font-size: 10.5px; color: #475569; line-height: 1.4; }
.refs { display: flex; gap: 6px; flex-shrink: 0; }
.ref { min-width: 74px; padding: 5px 9px; border: 1px solid #e2e8f0; border-radius: 6px; }
.ref b { display: block; font-size: 12px; color: #193d42; margin-top: 1px; }
.clinic { margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #f0fdfa; font-size: 10.5px; color: #334155; }
.clinic b { color: #0f766e; }
.rxno { margin-top: 4px; font-size: 9px; color: #94a3b8; }
/* Patient */
/* Spread across the full width, so the right side is never empty. */
.patient { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 22px; margin-top: 10px; padding: 9px 12px; border-radius: 7px; background: #f4f7f7; }
.info b { display: block; font-size: 12px; color: #243247; margin-top: 1px; }
.info.main b { font-size: 13.5px; color: #193d42; }
/* Rx */
.rx { display: flex; align-items: center; gap: 8px; margin: 14px 0 8px; }
.rx h1 { margin: 0; font-size: 18px; color: #193d42; }
.rx h1 em { font-style: normal; color: #0f766e; margin-right: 4px; }
.rx hr { flex: 1; border: 0; border-top: 1px solid #e2e8f0; margin: 0; }
.clinical { display: flex; gap: 8px; margin-bottom: 10px; }
.box { flex: 1; padding: 7px 10px; border-radius: 6px; background: #f0fdfa; border-left: 3px solid #14b8a6; }
.box.dx { background: #eef2ff; border-left-color: #6366f1; }
.box.dx span { color: #4338ca; }
.box b { display: block; font-size: 12px; color: #193d42; margin-top: 2px; }
h3 { margin: 0 0 4px; font-size: 12px; color: #193d42; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10.5px; }
thead { display: table-header-group; }
th { background: #0f766e; color: #fff; text-align: left; font-size: 9px; letter-spacing: .4px; text-transform: uppercase; padding: 6px 7px; }
td { padding: 6px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: anywhere; }
tbody tr:nth-child(even) td { background: #f8fafc; }
tr { break-inside: avoid; }
td i { color: #cbd5e1; font-style: normal; }
td small { display: block; font-size: 9.5px; color: #64748b; }
.n { width: 5%; text-align: center; } .name { width: 25%; } .notes { width: 24%; }
.empty { padding: 8px 10px; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b; text-align: center; }
.block { margin-top: 10px; }
.block p { font-size: 11px; color: #334155; }
.tests p { font-size: 11px; color: #334155; margin-bottom: 2px; }
/* Closing */
.foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: auto; padding-top: 12px; border-top: 1px solid #e2e8f0; break-inside: avoid; }
.follow { padding: 7px 11px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; }
.follow b { display: block; font-size: 12px; color: #475569; margin-top: 1px; }
.follow.on { background: #fffbeb; border-color: #fde68a; }
.follow.on span { color: #92400e; } .follow.on b { color: #b45309; font-size: 13px; }
.sign { width: 190px; text-align: right; }
.sign .img { height: 50px; display: flex; justify-content: flex-end; align-items: flex-end; }
.sign img { max-width: 160px; max-height: 50px; object-fit: contain; }
.sign hr { border: 0; border-top: 1px solid #94a3b8; margin: 4px 0; }
.sign b { display: block; font-size: 12.5px; color: #193d42; }
.sign p { font-size: 10px; color: #64748b; }
.sign span { margin-top: 3px; color: #94a3b8; }
.brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 16px; padding-top: 8px; border-top: 1px solid #cfe3e0; font-size: 8.5px; color: #64748b; }
.brand b { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; letter-spacing: 1.2px; color: #193d42; }
.brand img { width: 18px; height: 18px; }
/* Centred on the page, faint, clear of the signature. */
.watermark { position: absolute; left: 50%; top: 50%; width: 240px; margin-left: -120px; margin-top: -120px; opacity: .03; z-index: -1; }
</style></head><body><article class="doc">
<img class="watermark" src="${prescriptionWatermark}" alt=""/>
<header class="head">
<img class="logo" src="${prescriptionBrand}" alt="Humaeli"/>
<div class="doctor"><span>Prescribing doctor</span><h2>${esc(data.doctor)}</h2>${doctorLines.map(line => `<p>${esc(line)}</p>`).join('')}</div>
<div class="refs">${ref('Date', data.date)}${ref('Token', present(data.opd) ? `#${data.opd}` : '')}</div>
</header>
${clinicLine || contactLine ? `<div class="clinic">${clinicLine ? `<b>${clinicLine}</b>` : ''}${clinicLine && contactLine ? ' &nbsp;|&nbsp; ' : ''}${contactLine}</div>` : ''}
${rxNumber ? `<div class="rxno">Rx No. ${esc(rxNumber)}</div>` : ''}
<section class="patient"><div class="info main"><span>Patient</span><b>${esc(present(data.patient) ? data.patient : 'Patient')}</b></div>${info('Age / Gender', ageGender)}${info('Contact', data.phone)}${info('Weight', weight)}${info('Allergies', data.allergies)}${info('Patient ID', data.patientId)}</section>
<div class="rx"><h1><em>℞</em>Prescription</h1><hr/></div>
${present(data.issue) || present(data.diagnosis) ? `<div class="clinical">${present(data.issue) ? `<div class="box"><span>Consultation for</span><b>${esc(data.issue)}</b></div>` : ''}${present(data.diagnosis) ? `<div class="box dx"><span>Diagnosis</span><b>${esc(data.diagnosis)}</b></div>` : ''}</div>` : ''}
<h3>Prescribed medicines</h3>${medicines}
${(data.tests || []).length ? `<section class="block tests"><h3>Recommended tests</h3>${data.tests.map(test => `<p><b>${esc(test.testName || test.name)}</b>${esc(testLine(test))}</p>`).join('')}</section>` : ''}
${block('Advice & instructions', data.advice)}${data.notes !== data.advice ? block('Additional notes', data.notes) : ''}
<footer class="foot">
<div class="follow${hasFollowUp ? ' on' : ''}"><span>Next follow-up</span><b>${esc(followUp)}</b></div>
<div class="sign"><div class="img">${data.signature ? `<img src="${esc(data.signature)}" alt="Doctor signature"/>` : ''}</div><hr/><b>${esc(data.doctor)}</b>${present(data.qualification) ? `<p>${esc(data.qualification)}</p>` : ''}${present(data.registration) ? `<p>Reg. No.: ${esc(data.registration)}</p>` : ''}<span>Issued by</span></div>
</footer>
<div class="brand">This prescription is provided by <b><img src="${prescriptionFooter}" alt="Humaeli"/>HUMAELI</b> Talk. Connect. Feel Supported.</div>
</article></body></html>`;
};
