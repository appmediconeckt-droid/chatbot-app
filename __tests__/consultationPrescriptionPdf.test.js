import { NativeModules, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { buildSimplePdf } from '../src/features/doctor/dashboard/utils/prescriptionPdf';
import { downloadConsultationPrescriptionPdf } from '../src/features/doctor/dashboard/utils/consultationPrescriptionPdf';

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() }, NativeModules: { PrescriptionPrint: {}, PdfFileOpener: { open: jest.fn() } }, Platform: { OS: 'ios' },
}));
jest.mock('react-native-fs', () => ({ DocumentDirectoryPath: '/documents', writeFile: jest.fn(), exists: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); NativeModules.PrescriptionPrint = {}; });

it('paginates long prescriptions and emits valid PDF object offsets', () => {
  const pdf = buildSimplePdf(Array.from({ length: 100 }, (_, index) => `Recorded line ${index}`));
  expect(pdf).toContain('/Count 3');
  expect(pdf).toContain('Recorded line 99');
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  expect(pdf.slice(xref, xref + 4)).toBe('xref');
  const entries = pdf.slice(xref).split('\n').slice(3).filter(line => /^\d{10} 00000 n/.test(line));
  entries.forEach((entry, index) => expect(pdf.slice(Number(entry.slice(0, 10)))).toMatch(new RegExp(`^${index + 1} 0 obj`)));
});

it('retains notes, all recommended tests and the final footer in the fallback PDF', async () => {
  await downloadConsultationPrescriptionPdf({
    patient: 'Patient', doctor: 'Dr. Test', date: '16 Oct 2026', diagnosis: 'Recorded diagnosis',
    medicines: Array.from({ length: 50 }, (_, index) => ({ name: `Medicine ${index}`, dosage: 'Recorded dose' })),
    advice: 'Recorded advice', notes: 'Recorded additional notes',
    tests: [{ testName: 'Recorded test', completeBy: '2026-10-20', reason: 'Recorded reason', instructions: 'Recorded instructions' }],
  });
  const [path, pdf] = RNFS.writeFile.mock.calls[0];
  expect(path).toBe('/documents/prescription_Patient.pdf');
  ['Medicine 49', 'Recorded additional notes', 'Recorded test', '2026-10-20', 'Recorded instructions', 'Issued by'].forEach(value => expect(pdf).toContain(value));
  expect(pdf).toContain('/Count 3');
});

it('exports the web medicine table and all sections through the native PDF printer', async () => {
  NativeModules.PrescriptionPrint.createPdf = jest.fn().mockResolvedValue('/documents/native.pdf');
  RNFS.exists.mockResolvedValue(true);
  await downloadConsultationPrescriptionPdf({
    patient: 'Patient', doctor: 'Dr. Test', date: '16 Oct 2026', diagnosis: 'Diagnosis', medicines: [{ name: '<Medicine>', dosage: 'Dose', timings: ['Morning'], durationValue: '5', durationType: 'Days' }],
    notes: 'Additional notes', tests: [{ testName: 'Test', reason: 'Reason', instructions: 'Instructions' }],
  });
  const [html] = NativeModules.PrescriptionPrint.createPdf.mock.calls[0];
  ['<th>Medicine</th>', '&lt;Medicine&gt;', 'Morning', '5 Days', 'Additional notes', 'Instructions', 'Issued by'].forEach(value => expect(html).toContain(value));
  expect(RNFS.writeFile).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalledWith('PDF failed', expect.anything());
});
