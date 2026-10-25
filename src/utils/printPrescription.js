// Prints a doctor's prescription (one visit, as built by the patient's
// Prescriptions screen) through the native PrescriptionPrint module, which
// opens Android's print dialog — a printer or "Save as PDF".
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { buildConsultationDocumentHtml, doctorRxToDocument } from './consultationPrescriptionDocument';

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

// Same page as the in-app view and the web's PrescriptionDocument.
export const buildPrescriptionHtml = rx => buildConsultationDocumentHtml(doctorRxToDocument(rx));

const unavailable = () => {
  const error = new Error('This needs the latest app version.');
  error.code = 'PRINT_UNAVAILABLE';
  return error;
};

// One name per visit — patient, date and token — like the doctor's download.
// The doctor-and-date name was shared by every visit that day, so Downloads
// filled with "(1)", "(2)"… copies and an older one got opened.
const documentName = rx => {
  const doc = doctorRxToDocument(rx);
  const patient = doc.patient && doc.patient !== 'Patient' ? doc.patient : '';
  const date = doc.date && doc.date !== '—' ? doc.date : formatDate(rx.date);
  return ['Prescription', patient || rx.doctorName || '', date, doc.opd ? `Token ${doc.opd}` : '']
    .join(' ').replace(/\s+/g, ' ').trim();
};

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
  // The name is unique to this visit, so an existing file is an older copy of
  // it: replace it (an undeletable one, e.g. from an earlier install, is kept
  // and this copy is numbered instead).
  if (await RNFS.exists(path)) await RNFS.unlink(path).catch(() => {});
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
