// One prescription page, two outputs: the in-app paper (PrescriptionPaper in
// PrescriptionReviews.jsx — the psychiatrist preview) and the PDF / print
// HTML below, which mirrors that paper's sections, colours and layout. Doctor
// prescriptions are mapped onto the same paper (doctorRxToPaper), so a doctor's
// prescription reads and downloads exactly like a psychiatrist's.
import HUMAELI_LOGO from './humaeliLogoDataUri';
import { formatPrescriptionDateTime } from './prescriptionValidity';

const formatLongDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const consultationLabel = mode => {
  const value = String(mode || '').toLowerCase();
  if (value.includes('chat')) return 'Chat';
  if (value.includes('video')) return 'Video';
  if (value.includes('voice') || value.includes('phone')) return 'Voice';
  return 'In-clinic';
};

// A doctor prescription (as built by the patient's Prescriptions screen, or by
// the doctor app for a visit) → the paper's fields.
export const doctorRxToPaper = rx => ({
  rxNumber: rx.rxNumber || '',
  issuedLabel: rx.date ? formatPrescriptionDateTime(rx.date) : '',
  brandSub: 'Digital Prescription',
  clinicLine: [rx.clinic?.name, rx.clinic?.location].filter(Boolean).join(' · '),
  practitioner: {
    name: rx.doctorName || 'Doctor',
    type: rx.specialization || (rx.kind === 'psychiatrist' ? 'Psychiatrist' : 'Doctor'),
  },
  practitionerId: rx.doctorId ? `...${String(rx.doctorId).slice(-4)}` : '',
  patientName: rx.patientName || '',
  complaint: rx.complaint || '',
  sections: [
    { tag: 'DIAGNOSIS', text: rx.diagnosis || '' },
    {
      tag: 'VISIT',
      text: rx.tokenNumber
        ? `${consultationLabel(rx.consultationMode)} · Token #${rx.tokenNumber}`
        : '',
    },
  ],
  medicines: (rx.medicines || []).map((medicine, index) => ({
    key: `${rx.id || 'rx'}-med-${index}`,
    name: medicine.name || '',
    details: [
      ['DOSE', medicine.dosage],
      ['WHEN', (medicine.timings || []).filter(Boolean).join(' · ')],
      ['FOOD', medicine.food],
      ['DURATION', medicine.duration],
    ].filter(([, value]) => value),
  })),
  notes: [
    { tag: 'ADVICE', text: rx.advice || '' },
    { tag: 'RECOMMENDED TESTS', text: (rx.tests || []).filter(Boolean).join(', ') },
    { tag: "DOCTOR'S NOTES", text: rx.additionalNotes || '' },
    { tag: 'FOLLOW-UP VISIT', text: rx.followUpDate ? formatLongDate(rx.followUpDate) : '' },
  ],
});

const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const initialOf = name =>
  String(name || '').replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || '•';

// The paper as a printable A4 HTML page (same fields as PrescriptionPaper).
export const buildPrescriptionPaperHtml = paper => {
  const sections = (paper.sections || []).filter(section => section.text);
  const notes = (paper.notes || []).filter(note => note.text);
  const medicines = paper.medicines || [];
  const practitioner = paper.practitioner || {};
  const box = (cls, tag, text) =>
    `<div class="${cls}"><div class="tag">${esc(tag)}</div><div class="${cls}-text">${esc(text)}</div></div>`;
  const medicineRows = medicines.length
    ? medicines
        .map(
          (medicine, index) => `<div class="med">
        <div class="idx">${index + 1}.</div>
        <div class="med-body">
          <div class="med-name">${esc(medicine.name)}</div>
          ${(medicine.details || []).length
            ? `<div class="grid">${medicine.details
                .map(([label, value]) => `<div class="cell"><div class="lbl">${esc(label)}</div><div class="val">${esc(value)}</div></div>`)
                .join('')}</div>`
            : ''}
        </div>
      </div>`,
        )
        .join('')
    : '<div class="muted">No medicines prescribed.</div>';

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; color: #172033; font-size: 12.5px; }
  html, body { width: 186mm; }
  .paper { position: relative; width: 186mm; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 6px; padding: 22px 24px; overflow: hidden; }
  .watermark { position: absolute; top: 50%; left: 50%; width: 320px; height: 320px; margin: -160px 0 0 -160px; opacity: .06; }
  .head { display: flex; align-items: center; gap: 12px; position: relative; }
  .head .logo { width: 48px; height: 48px; }
  .brand { flex: 1; }
  .brand-name { font-size: 22px; font-weight: 900; color: #0F2A5F; letter-spacing: .3px; }
  .brand-sub { font-size: 11px; font-weight: 700; color: #64748B; margin-top: 1px; }
  .meta { text-align: right; }
  .rxno { display: inline-block; font-size: 11.5px; font-weight: 900; color: #1D4ED8; background: #DBEAFE; padding: 3px 9px; border-radius: 6px; letter-spacing: .5px; }
  .issued { font-size: 10.5px; font-weight: 700; color: #64748B; margin-top: 5px; }
  .rule { height: 6px; border-top: 2.5px solid #2563EB; border-bottom: 1px solid #2563EB; margin: 12px 0 12px; }
  .tag { font-size: 10px; font-weight: 900; color: #2563EB; letter-spacing: 1px; margin-bottom: 3px; }
  .prescriber { margin-bottom: 10px; position: relative; }
  .doc { font-size: 19px; font-weight: 800; color: #172033; }
  .type { color: #0F766E; font-size: 13.5px; font-weight: 800; margin-top: 3px; text-transform: capitalize; }
  .pid { color: #64748B; font-size: 11px; font-weight: 800; margin-top: 5px; }
  .patient { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #F1F5F9; border-radius: 12px; position: relative; }
  .avatar { width: 44px; height: 44px; border-radius: 22px; background: #DBEAFE; color: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; flex-shrink: 0; }
  .pname { font-size: 17px; font-weight: 800; color: #172033; }
  .complaint { margin-top: 10px; padding: 9px 12px; border-radius: 10px; border: 1px solid #DBEAFE; background: #EFF6FF; position: relative; }
  .complaint-text { font-size: 14px; font-weight: 700; color: #172033; line-height: 1.45; }
  .rxrow { display: flex; align-items: center; gap: 8px; margin: 14px 0 2px; }
  .sym { font-size: 32px; font-weight: 900; font-style: italic; color: #2563EB; line-height: 1; }
  .medh { font-size: 16px; font-weight: 900; color: #172033; }
  .muted { font-size: 12px; color: #64748B; margin-top: 3px; }
  .med { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid #E2E8F0; page-break-inside: avoid; position: relative; }
  .idx { width: 22px; font-size: 14.5px; font-weight: 900; color: #1E3A8A; }
  .med-body { flex: 1; }
  .med-name { font-size: 14.5px; font-weight: 900; color: #0F172A; }
  .grid { display: flex; flex-wrap: wrap; margin-top: 4px; row-gap: 4px; }
  .cell { width: 25%; padding-right: 8px; }
  .lbl { font-size: 9.5px; font-weight: 900; color: #94A3B8; letter-spacing: .8px; }
  .val { font-size: 12.5px; font-weight: 700; color: #334155; margin-top: 1px; }
  .note { margin-top: 10px; padding: 9px 12px; border-left: 4px solid #2563EB; background: #EFF6FF; page-break-inside: avoid; position: relative; }
  .note-text { font-size: 13px; color: #334155; line-height: 1.45; }
  .sign-block { margin-top: 22px; display: flex; justify-content: flex-end; page-break-inside: avoid; position: relative; }
  .sign { min-width: 190px; max-width: 68%; text-align: center; }
  .auto { color: #1E3A8A; font-size: 26px; font-family: 'Snell Roundhand', 'Brush Script MT', cursive; font-style: italic; transform: rotate(-3deg); margin-bottom: 2px; }
  .line { height: 1px; background: #CBD5E1; margin-top: 2px; }
  .sname { color: #172033; font-size: 12px; font-weight: 900; margin-top: 3px; }
  .stype { color: #0F766E; font-size: 10px; font-weight: 800; margin-top: 1px; }
  .signed { color: #16A34A; font-size: 10px; font-weight: 800; margin-top: 5px; }
  .footer { font-size: 9px; color: #64748B; text-align: center; border-top: 1px solid #DBE4EF; padding-top: 10px; margin-top: 16px; position: relative; }
</style></head><body>
<div class="paper">
  <img class="watermark" src="${HUMAELI_LOGO}" alt=""/>
  <div class="head">
    <img class="logo" src="${HUMAELI_LOGO}" alt="Humaeli"/>
    <div class="brand">
      <div class="brand-name">Humaeli</div>
      <div class="brand-sub">${esc(paper.brandSub || 'Digital Prescription')}</div>
      ${paper.clinicLine ? `<div class="brand-sub">${esc(paper.clinicLine)}</div>` : ''}
    </div>
    <div class="meta">
      ${paper.rxNumber ? `<span class="rxno">${esc(paper.rxNumber)}</span>` : ''}
      ${paper.issuedLabel ? `<div class="issued">${esc(paper.issuedLabel)}</div>` : ''}
    </div>
  </div>
  <div class="rule"></div>

  <div class="prescriber">
    <div class="tag">PRESCRIBED BY</div>
    <div class="doc">${esc(practitioner.name)}</div>
    <div class="type">${esc(practitioner.type)}</div>
    ${paper.practitionerId ? `<div class="pid">Practitioner ID: ${esc(paper.practitionerId)}</div>` : ''}
  </div>

  <div class="patient">
    <div class="avatar">${esc(initialOf(paper.patientName))}</div>
    <div><div class="tag">PATIENT</div><div class="pname">${esc(paper.patientName || 'Patient')}</div></div>
  </div>

  ${paper.complaint ? box('complaint', 'CHIEF COMPLAINT', paper.complaint) : ''}
  ${sections.map(section => box('complaint', section.tag, section.text)).join('')}

  <div class="rxrow"><span class="sym">℞</span><span class="medh">Medicines</span></div>
  ${medicineRows}

  ${notes.map(note => box('note', note.tag, note.text)).join('')}

  <div class="sign-block">
    <div class="sign">
      <div class="auto">${esc(practitioner.name)}</div>
      <div class="line"></div>
      <div class="sname">${esc(practitioner.name)}</div>
      <div class="stype">${esc(practitioner.type)}</div>
      <div class="signed">✓ Digitally signed${paper.issuedLabel ? ` · ${esc(paper.issuedLabel)}` : ''}</div>
    </div>
  </div>
  <div class="footer">Issued through Humaeli · www.humaeli.com · support@humaeli.com</div>
</div>
<script>
  // One A4 page, always: the printable height is 297mm minus the 12mm
  // @page margins (273mm ≈ 1031 CSS px at 96 dpi). A longer prescription
  // (many medicines) is zoomed down to fit instead of spilling onto page 2.
  (function () {
    var paper = document.querySelector('.paper');
    if (!paper) return;
    // Head-room under 1031px: print can wrap text a little differently.
    var maxHeight = 960;
    var height = paper.getBoundingClientRect().height;
    if (height > maxHeight) paper.style.zoom = (maxHeight / height).toFixed(4);
  })();
</script>
</body></html>`;
};
