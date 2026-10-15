// Patients & prescriptions — the web StaffPatientHistory:
// GET /api/staff/patient-history (completed visits + chat prescriptions) with
// search / date / clinic / record-type filters. Every page of records is
// loaded and grouped by patient, so each patient appears once; opening a
// patient lists their visits, and a visit opens its prescription, which can be
// downloaded as the shared prescription PDF.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../components/TranslatedText';
import {
  AlertBox, Card, CardHeading, Empty, Notice, NoticeText, OptionSheet, REC, RecButton, SelectField, StatTile,
} from '../receptionistUi';
import { apiError, fetchPatientHistory } from '../receptionistApi';
import { clinicName, dateLabel, displayTime, statusLabel } from '../receptionistUtils';
import { getDoctorMedicines, getDoctorTests, unpackConsultationNotes } from '../../../utils/consultationDetails';
import { downloadVisitPrescriptionPdf } from '../../doctor/dashboard/utils/prescriptionPdf';

const EMPTY = { from: '', to: '', clinic_id: '', source: 'all', search: '' };
const SOURCES = [['all', 'All records'], ['online', 'Online visits'], ['walkin', 'Walk-in visits'], ['prescription', 'Chat prescriptions']];
const PER_PAGE = 10;       // patients shown per page
const FETCH_LIMIT = 50;    // records requested per API page
const MAX_FETCH_PAGES = 40;
const SOURCE_STYLE = {
  walkin: { label: 'Walk-in', icon: 'walk-outline', bg: '#FFF4DF', fg: '#C27C0E' },
  online: { label: 'Online', icon: 'videocam-outline', bg: '#E8F1FF', fg: '#3975C7' },
  prescription: { label: 'Chat Rx', icon: 'chatbubble-ellipses-outline', bg: '#EFEAFE', fg: '#6A4FC4' },
};
const sourceStyle = (source) => SOURCE_STYLE[source] || { label: statusLabel(source), icon: 'document-text-outline', bg: '#EDF2F7', fg: '#658097' };
// "#3" means token 3 — the API matches the bare number only.
const cleanSearch = (value = '') => value.trim().replace(/^#s*/, '');
const toKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const isRealName = (value) => typeof value === 'string' && value.trim() && !/^doctor$/i.test(value.trim());
const prescriptionDoctorName = (record = {}, fallback) =>
  [fallback, record.psychiatrist?.name, record.psychiatrist?.fullName, record.doctor?.name, record.doctor?.fullName,
    record.doctorName, record.doctor_name, record.psychiatristSnapshot?.name, record.counselor?.fullName]
    .find(isRealName)?.trim() || 'Doctor name not recorded';

// The prescription as the doctor recorded it (packed consultation notes included).
const readPrescription = (raw = {}) => {
  const record = unpackConsultationNotes(raw) || {};
  const followUpRequired = [true, 1, '1', 'true'].includes(record.followUpRequired ?? record.follow_up_required);
  return {
    issue: record.issue || record.problem || '',
    diagnosis: record.diagnosis || record.problem || '',
    medicines: getDoctorMedicines(record),
    advice: record.advice || record.instructions || '',
    notes: record.additionalNotes || record.additional_notes || '',
    tests: getDoctorTests(record),
    followUp: record.followUpDate || record.follow_up_date || '',
    followUpRequired,
    gender: record.patient?.gender || record.gender || '',
  };
};

// The API pages records, so the same patient can sit on several pages —
// collect them all before grouping.
const fetchAllHistory = async (query) => {
  const first = await fetchPatientHistory({ ...query, page: 1, limit: FETCH_LIMIT });
  const records = [...(first?.records || [])];
  const total = Number(first?.total) || records.length;
  for (let page = 2; records.length < total && page <= MAX_FETCH_PAGES; page += 1) {
    const next = await fetchPatientHistory({ ...query, page, limit: FETCH_LIMIT });
    if (!next?.records?.length) break;
    records.push(...next.records);
  }
  const seen = new Set();
  return { ...first, records: records.filter((row) => row.id == null || (seen.has(row.id) ? false : seen.add(row.id))) };
};

const visitTime = (row) => new Date(row.checkedAt || row.checkedDate || 0).getTime() || 0;
// Walk-in records carry no patient id, so phone + name identifies a person
// across walk-in and online visits; a record with neither phone nor id stays
// on its own rather than merging every unnamed "Patient".
const patientKey = (row = {}) => {
  const patient = row.patient || {};
  const phone = String(patient.phoneNumber || patient.phone || '').replace(/\D/g, '').slice(-10);
  const name = String(patient.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (phone) return `ph:${phone}:${name}`;
  const id = patient.id || patient._id || patient.userId || patient.user_id;
  return id ? `id:${id}` : `rec:${row.id}`;
};
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';

const groupByPatient = (records = []) => {
  const groups = new Map();
  records.forEach((row) => {
    const key = patientKey(row);
    if (!groups.has(key)) groups.set(key, { key, patient: row.patient || {}, visits: [] });
    const group = groups.get(key);
    group.visits.push(row);
    if (!group.patient.phoneNumber && row.patient?.phoneNumber) group.patient = { ...group.patient, ...row.patient };
  });
  return [...groups.values()].map((group) => {
    const visits = group.visits.sort((a, b) => visitTime(b) - visitTime(a));
    const counts = visits.reduce((acc, row) => ({ ...acc, [row.source]: (acc[row.source] || 0) + 1 }), {});
    return { ...group, visits, latest: visits[0], counts, prescriptions: visits.filter((row) => row.hasPrescription).length };
  }).sort((a, b) => visitTime(b.latest) - visitTime(a.latest));
};

export default function PatientsSection() {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState(EMPTY);
  const [query, setQuery] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [openPatient, setOpenPatient] = useState(null); // patient group whose visits are listed
  const [selected, setSelected] = useState(null);       // visit whose prescription is shown
  const [picker, setPicker] = useState(null); // 'from' | 'to' | 'clinic' | 'source'
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelected(null);
    setOpenPatient(null);
    fetchAllHistory(query)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => {
        if (!cancelled) {
          setError(apiError(err, 'Patient history could not be loaded. Please retry.'));
          setData(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, refresh]);

  const patients = useMemo(() => groupByPatient(data?.records), [data]);

  const run = (next) => {
    if (next.from && next.to && next.from > next.to) {
      setError('Start date must be before end date.');
      return;
    }
    setQuery({ ...next, search: cleanSearch(next.search) });
    setPage(1);
  };
  const apply = () => run(filters);
  // Dates, clinic, record type and their ✕ apply straight away; typed search
  // applies on the keyboard's search key, Apply, or after a short pause.
  const update = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    run(next);
  };
  const reset = () => { setError(''); setFilters(EMPTY); setQuery(EMPTY); setPage(1); };

  useEffect(() => {
    if (cleanSearch(filters.search) === query.search) return undefined;
    const timer = setTimeout(() => run(filters), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);
  const doctorFor = (record) => prescriptionDoctorName(record?.prescription || {}, record?.doctor?.name || record?.doctor?.fullName || data?.doctor?.name || data?.doctor?.fullName);
  const closeSheet = () => { setSelected(null); setOpenPatient(null); };
  const visitWhen = (row) => `${dateLabel(row.checkedDate)} · ${row.checkedAt ? displayTime(row.checkedAt) : row.appointmentTime || 'Time not recorded'}`;
  const visitTitle = (row) => `${row.source === 'prescription' ? 'Chat prescription' : `${statusLabel(row.source)} checkup`}${row.token != null ? ` · Token #${row.token}` : ''}`;

  const onPickDate = (event, date) => {
    const which = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (event?.type === 'dismissed' || !date || !which) return;
    update({ [which]: toKey(date) });
  };

  const download = async () => {
    if (!selected) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const rx = readPrescription(selected.prescription);
      await downloadVisitPrescriptionPdf(
        { name: selected.patient?.name, gender: rx.gender },
        {
          id: selected.id,
          date: dateLabel(selected.checkedDate),
          doctor: doctorFor(selected),
          problem: rx.issue,
          diagnosis: rx.diagnosis,
          medicines: rx.medicines,
          advice: rx.advice,
          tests: rx.tests,
          additionalNotes: rx.notes,
          followUp: rx.followUp ? dateLabel(rx.followUp) : 'Not required',
        },
      );
    } catch {
      setDownloadError('Prescription PDF could not be downloaded. Please retry.');
    } finally {
      setDownloading(false);
    }
  };

  const pages = Math.max(1, Math.ceil(patients.length / PER_PAGE));
  const shown = patients.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const clinics = data?.clinics || [];
  const rx = selected ? readPrescription(selected.prescription) : null;

  return (
    <>
      <Card>
        <CardHeading
          title="Patients & prescriptions"
          right={<RecButton compact icon="refresh" disabled={loading} onPress={() => setRefresh((value) => value + 1)} />}
        />
        {!!data && (
          <View style={s.inline}>
            <Ionicons name="medkit-outline" size={17} color={REC.primary} />
            <Text translate={false} style={s.doctor}>{data.doctor?.name || data.doctor?.fullName}</Text>
            <Text translate={false} style={s.count}>Updated {displayTime(data.updatedAt)}</Text>
          </View>
        )}
      </Card>

      {!!data && (
        <View style={s.stats}>
          <StatTile title="Patients" value={patients.length} icon="people-outline" tone="teal" />
          <StatTile title="Completed visits" value={data.summary?.visits} icon="calendar-outline" tone="teal" />
          <StatTile title="Treatment records" value={data.summary?.prescriptions} icon="document-text-outline" tone="teal" />
        </View>
      )}

      <Card>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={REC.muted} />
          <TextInput
            value={filters.search}
            onChangeText={(value) => setFilters((current) => ({ ...current, search: value }))}
            onSubmitEditing={apply}
            returnKeyType="search"
            style={s.searchInput}
            placeholder="Search patient, phone or token"
            placeholderTextColor="#94A3B8"
          />
        </View>
        <View style={s.twoCol}>
          <View style={s.flex}>
            <SelectField
              label="Checked from"
              icon="calendar-outline"
              valueLabel={filters.from ? dateLabel(filters.from) : 'Any date'}
              active={Boolean(filters.from)}
              onPress={() => setPicker('from')}
              onClear={() => update({ from: '' })}
            />
          </View>
          <View style={s.flex}>
            <SelectField
              label="Checked to"
              icon="calendar-outline"
              valueLabel={filters.to ? dateLabel(filters.to) : 'Any date'}
              active={Boolean(filters.to)}
              onPress={() => setPicker('to')}
              onClear={() => update({ to: '' })}
            />
          </View>
        </View>
        <View style={s.twoCol}>
          <View style={s.flex}>
            <SelectField
              label="Clinic"
              icon="business-outline"
              valueLabel={filters.clinic_id ? clinicName(clinics, filters.clinic_id) : 'All clinics'}
              active={Boolean(filters.clinic_id)}
              onPress={() => setPicker('clinic')}
              onClear={() => update({ clinic_id: '' })}
            />
          </View>
          <View style={s.flex}>
            <SelectField
              label="Record type"
              valueLabel={(SOURCES.find(([value]) => value === filters.source) || SOURCES[0])[1]}
              active={filters.source !== 'all'}
              onPress={() => setPicker('source')}
              onClear={() => update({ source: 'all' })}
            />
          </View>
        </View>
        <View style={s.actions}>
          <RecButton primary label="Apply filters" disabled={loading} onPress={apply} style={s.flex} />
          <RecButton danger icon="close-circle-outline" label="Clear" onPress={reset} />
        </View>

        <AlertBox text={error} />
        {loading ? (
          <View style={s.loading}><ActivityIndicator color={REC.primary} /><Text style={s.muted}>Loading patient history...</Text></View>
        ) : !!data && (
          <>
            {/* The API sets this flag on every response; the hint only makes sense once a clinic is picked. */}
            {data.separatePrescriptionsExcluded && !!query.clinic_id && (
              <Notice icon="alert-circle-outline" iconColor="#C27C0E" style={s.warning}>
                <NoticeText>Chat prescriptions are not linked to a clinic. Select All clinics to include them.</NoticeText>
              </Notice>
            )}
            {shown.length ? shown.map((group) => (
              <PatientCard
                key={group.key}
                group={group}
                doctor={doctorFor(group.latest)}
                when={visitWhen(group.latest)}
                onPress={() => { setOpenPatient(group); setSelected(null); setDownloadError(''); }}
              />
            )) : <Empty title="No completed visits or prescriptions found" description="Change your filters or refresh after your doctor completes a consultation." />}
            <View style={s.pagination}>
              <Text translate={false} style={s.muted}>
                {patients.length} {patients.length === 1 ? 'patient' : 'patients'} · {data.records?.length || 0} records
              </Text>
              {pages > 1 && (
                <View style={s.pageButtons}>
                  <RecButton compact label="Previous" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} />
                  <Text translate={false} style={s.pageNow}>Page {page} of {pages}</Text>
                  <RecButton compact label="Next" disabled={page >= pages} onPress={() => setPage((value) => value + 1)} />
                </View>
              )}
            </View>
          </>
        )}
      </Card>

      {(picker === 'from' || picker === 'to') && (
        <DateTimePicker
          value={filters[picker] ? new Date(`${filters[picker]}T00:00:00`) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPickDate}
        />
      )}
      <OptionSheet
        visible={picker === 'clinic'}
        title="Clinic"
        value={filters.clinic_id}
        options={[{ value: '', label: 'All clinics' }, ...clinics.map((row) => ({ value: String(row._id || row.id), label: row.clinic_name }))]}
        onSelect={(value) => update({ clinic_id: value })}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        visible={picker === 'source'}
        title="Record type"
        value={filters.source}
        options={SOURCES.map(([value, label]) => ({ value, label }))}
        onSelect={(value) => update({ source: value })}
        onClose={() => setPicker(null)}
      />

      <Modal
        visible={Boolean(openPatient || selected)}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => (selected && openPatient ? setSelected(null) : closeSheet())}
      >
        <Pressable style={s.overlay} onPress={closeSheet}>
          <Pressable style={[s.sheet, { paddingBottom: 18 + insets.bottom }]} onPress={() => {}}>
            <View style={s.handle} />
            {selected && rx ? (
              <>
                <View style={s.sheetHead}>
                  {!!openPatient && (
                    <Pressable onPress={() => { setSelected(null); setDownloadError(''); }} style={s.close} hitSlop={8}>
                      <Ionicons name="arrow-back" size={20} color={REC.ink} />
                    </Pressable>
                  )}
                  <View style={s.flex}>
                    <Text translate={false} style={s.sheetName}>{selected.patient?.name}</Text>
                    <Text translate={false} style={s.muted}>Prescribing doctor: {doctorFor(selected)} / {dateLabel(selected.checkedDate)}</Text>
                  </View>
                  <Pressable onPress={closeSheet} style={s.close} hitSlop={8}>
                    <Ionicons name="close" size={20} color={REC.ink} />
                  </Pressable>
                </View>
                <Text translate={false} style={s.visitMeta}>
                  {selected.source === 'prescription'
                    ? 'Prescription issued after a chat consultation'
                    : `Completed ${selected.source === 'walkin' ? 'walk-in' : 'online'} checkup${selected.token != null ? ` / Token #${selected.token}` : ''}`}
                </Text>
                <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
                  {!!selected.symptoms && <Field title="Symptoms" value={selected.symptoms} />}
                  {!selected.hasPrescription && (
                    <Notice style={s.sheetNotice}><NoticeText>No prescription has been recorded for this visit.</NoticeText></Notice>
                  )}
                  <View style={s.paper}>
                    <Text style={s.paperEyebrow}>CONSULTATION RECORD</Text>
                    <Text style={s.paperTitle}>Prescription</Text>
                    <View style={s.paperRow}>
                      <Field title="Patient name" value={selected.patient?.name || 'Patient'} half />
                      <Field title="Gender" value={rx.gender || '—'} half />
                    </View>
                    <Field title="Consultation for" value={rx.issue || '—'} />
                    <Field title="Diagnosis" value={rx.diagnosis || '—'} />
                    <Text style={s.fieldTitle}>℞ Prescribed medicines</Text>
                    {rx.medicines.length ? rx.medicines.map((m, index) => (
                      <View key={`${m.name}-${index}`} style={s.medicine}>
                        <Text translate={false} style={s.medicineName}>{m.name}</Text>
                        <Text translate={false} style={s.muted}>
                          {[m.dosage, m.timings.join(', '), m.duration].filter(Boolean).join(' · ') || '—'}
                        </Text>
                      </View>
                    )) : <Text style={s.fieldValue}>No medicines prescribed.</Text>}
                    {!!rx.advice && <Field title="Advice & instructions" value={rx.advice} />}
                    {!!rx.notes && rx.notes !== rx.advice && <Field title="Additional notes" value={rx.notes} />}
                    {rx.tests.length > 0 && <Field title="Recommended tests" value={rx.tests.join(', ')} />}
                    <View style={s.paperRow}>
                      <Field title="Follow-up" value={rx.followUp ? dateLabel(rx.followUp) : rx.followUpRequired ? 'Required' : 'No follow-up scheduled'} half />
                      <Field title="Issued by" value={doctorFor(selected)} half />
                    </View>
                  </View>
                </ScrollView>
                <AlertBox text={downloadError} />
                <View style={s.sheetActions}>
                  <RecButton label={openPatient ? 'Back to visits' : 'Close'} onPress={() => (openPatient ? setSelected(null) : closeSheet())} style={s.flex} />
                  {selected.hasPrescription && (
                    <RecButton primary icon="download-outline" label={downloading ? 'Downloading...' : 'Download PDF'} disabled={downloading} onPress={download} style={s.flex} />
                  )}
                </View>
              </>
            ) : !!openPatient && (
              <>
                <View style={s.sheetHead}>
                  <View style={[s.avatar, s.avatarLarge]}>
                    <Text translate={false} style={[s.avatarText, s.avatarTextLarge]}>{initials(openPatient.patient.name)}</Text>
                  </View>
                  <View style={s.flex}>
                    <Text translate={false} style={s.sheetName} numberOfLines={1}>{openPatient.patient.name || 'Patient'}</Text>
                    <Text translate={false} style={s.muted}>{openPatient.patient.phoneNumber || 'Phone not recorded'}</Text>
                  </View>
                  <Pressable onPress={closeSheet} style={s.close} hitSlop={8}>
                    <Ionicons name="close" size={20} color={REC.ink} />
                  </Pressable>
                </View>
                <View style={s.summaryRow}>
                  <SummaryPill value={openPatient.visits.length} label={openPatient.visits.length === 1 ? 'Visit' : 'Visits'} />
                  <SummaryPill value={openPatient.prescriptions} label={openPatient.prescriptions === 1 ? 'Prescription' : 'Prescriptions'} />
                  <SummaryPill value={dateLabel(openPatient.latest.checkedDate)} label="Last visit" />
                </View>
                <Text style={s.sectionLabel}>VISIT HISTORY</Text>
                <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
                  {openPatient.visits.map((row, index) => {
                    const src = sourceStyle(row.source);
                    const last = index === openPatient.visits.length - 1;
                    return (
                      <Pressable
                        key={row.id}
                        onPress={() => { setSelected(row); setDownloadError(''); }}
                        style={({ pressed }) => [s.visit, pressed && s.pressed]}
                      >
                        <View style={s.timeline}>
                          <View style={[s.visitIcon, { backgroundColor: src.bg }]}>
                            <Ionicons name={src.icon} size={16} color={src.fg} />
                          </View>
                          {!last && <View style={s.timelineLine} />}
                        </View>
                        <View style={[s.visitBody, !last && s.visitBodyDivider]}>
                          <View style={s.visitTop}>
                            <Text translate={false} style={s.visitTitle} numberOfLines={1}>{visitTitle(row)}</Text>
                            <Ionicons name="chevron-forward" size={16} color="#A0AEBB" />
                          </View>
                          <Text translate={false} style={s.visitSub} numberOfLines={1}>{visitWhen(row)}</Text>
                          <Text translate={false} style={s.visitSub} numberOfLines={1}>
                            {doctorFor(row)} · {row.source === 'prescription' ? 'Chat consultation' : clinicName(clinics, row.clinicId)}
                          </Text>
                          <Text translate={false} style={s.visitDiagnosis} numberOfLines={2}>
                            {row.diagnosis || row.prescription?.problem || 'Diagnosis not recorded'}
                          </Text>
                          <View style={[s.rxTag, !row.hasPrescription && s.rxTagMissing]}>
                            <Ionicons
                              name={row.hasPrescription ? 'document-text-outline' : 'remove-circle-outline'}
                              size={12}
                              color={row.hasPrescription ? REC.primary : '#94A3B8'}
                            />
                            <Text style={[s.rxTagText, !row.hasPrescription && s.rxTagTextMissing]}>
                              {row.hasPrescription ? 'Prescription available' : 'Prescription not recorded'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function PatientCard({ group, doctor, when, onPress }) {
  const { patient, visits, latest, counts } = group;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.patient, pressed && s.pressed]}>
      <View style={s.patientTop}>
        <View style={s.avatar}>
          <Text translate={false} style={s.avatarText}>{initials(patient.name)}</Text>
        </View>
        <View style={s.flex}>
          <Text translate={false} style={s.patientName} numberOfLines={1}>{patient.name || 'Patient'}</Text>
          <View style={s.phoneRow}>
            <Ionicons name="call-outline" size={12} color={REC.muted} />
            <Text translate={false} style={s.muted} numberOfLines={1}>{patient.phoneNumber || 'Phone not recorded'}</Text>
          </View>
        </View>
        <View style={s.visitCount}>
          <Text translate={false} style={s.visitCountValue}>{visits.length}</Text>
          <Text style={s.visitCountLabel}>{visits.length === 1 ? 'visit' : 'visits'}</Text>
        </View>
      </View>

      <View style={s.lastVisit}>
        <Text style={s.lastLabel}>LAST VISIT</Text>
        <View style={s.metaLine}>
          <Ionicons name="calendar-outline" size={13} color={REC.muted} />
          <Text translate={false} style={s.metaText} numberOfLines={1}>{when}</Text>
        </View>
        <View style={s.metaLine}>
          <Ionicons name="person-outline" size={13} color={REC.muted} />
          <Text translate={false} style={s.metaText} numberOfLines={1}>{doctor}</Text>
        </View>
        <Text translate={false} style={s.diagnosis} numberOfLines={2}>
          {latest.diagnosis || latest.prescription?.problem || 'Diagnosis not recorded'}
        </Text>
      </View>

      <View style={s.patientFooter}>
        <View style={s.chips}>
          {Object.entries(counts).map(([source, count]) => {
            const src = sourceStyle(source);
            return (
              <View key={source} style={[s.chip, { backgroundColor: src.bg }]}>
                <Ionicons name={src.icon} size={12} color={src.fg} />
                <Text translate={false} style={[s.chipText, { color: src.fg }]}>{count} {src.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={s.openLink}>
          <Text style={s.openText}>View visits</Text>
          <Ionicons name="chevron-forward" size={15} color={REC.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function SummaryPill({ value, label }) {
  return (
    <View style={s.summaryPill}>
      <Text translate={false} style={s.summaryValue} numberOfLines={1}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

function Field({ title, value, half }) {
  return (
    <View style={[s.field, half && s.half]}>
      <Text style={s.fieldTitle}>{title}</Text>
      <Text translate={false} style={s.fieldValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  muted: { fontSize: 12.5, color: REC.muted },
  doctor: { fontSize: 14, fontWeight: '700', color: REC.ink },
  count: { fontSize: 11, fontWeight: '600', color: '#728798', backgroundColor: '#F1F5F8', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
  search: { height: 44, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 12, backgroundColor: '#FAFBFD' },
  searchInput: { flex: 1, fontSize: 14, color: REC.ink, paddingVertical: 0 },
  twoCol: { flexDirection: 'row', gap: 10 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  warning: { marginTop: 2, marginBottom: 14, backgroundColor: '#FFF8EC', borderColor: '#F6DDAE' },
  pressed: { opacity: 0.75 },

  patient: {
    borderWidth: 1, borderColor: REC.line, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  patientTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: REC.primary },
  avatarLarge: { width: 48, height: 48, borderRadius: 24 },
  avatarTextLarge: { fontSize: 17 },
  patientName: { fontSize: 15.5, fontWeight: '700', color: REC.ink },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  visitCount: { alignItems: 'center', minWidth: 52, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#F1F7F5', borderWidth: 1, borderColor: '#D6EAE3' },
  visitCountValue: { fontSize: 16, fontWeight: '800', color: REC.primary, lineHeight: 19 },
  visitCountLabel: { fontSize: 10.5, fontWeight: '600', color: REC.softText },
  lastVisit: { marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: '#F7F9FB', gap: 5 },
  lastLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#94A3B8', marginBottom: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flexShrink: 1, fontSize: 12.5, color: '#5B6B7B' },
  diagnosis: { fontSize: 13, fontWeight: '600', color: REC.ink, marginTop: 3 },
  patientFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  openLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { fontSize: 12.5, fontWeight: '700', color: REC.primary },

  pagination: { marginTop: 6, gap: 10 },
  pageButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageNow: { fontSize: 13, fontWeight: '700', color: REC.ink },

  overlay: { flex: 1, backgroundColor: 'rgba(32,50,72,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetName: { fontSize: 20, fontWeight: '700', color: REC.ink },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F5F7', alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  summaryPill: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, borderColor: REC.line, backgroundColor: '#FAFBFD', paddingVertical: 9, paddingHorizontal: 10 },
  summaryValue: { fontSize: 14.5, fontWeight: '800', color: REC.ink },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: REC.muted, marginTop: 1 },
  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4, color: REC.muted, marginTop: 16 },
  visit: { flexDirection: 'row', gap: 12 },
  timeline: { alignItems: 'center', width: 32 },
  visitIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E6ECF0', marginVertical: 4 },
  visitBody: { flex: 1, minWidth: 0, paddingBottom: 14, marginBottom: 12, gap: 3 },
  visitBodyDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F5' },
  visitTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  visitTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: REC.ink },
  visitSub: { fontSize: 12.5, color: '#5B6B7B' },
  visitDiagnosis: { fontSize: 13, fontWeight: '600', color: REC.ink, marginTop: 2 },
  rxTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: REC.soft },
  rxTagMissing: { backgroundColor: '#F1F5F8' },
  rxTagText: { fontSize: 11, fontWeight: '700', color: REC.primary },
  rxTagTextMissing: { color: '#94A3B8' },

  visitMeta: { fontSize: 12.5, color: '#4A8875', marginTop: 8 },
  sheetScroll: { marginTop: 12 },
  sheetNotice: { marginTop: 4 },
  paper: { borderWidth: 1, borderColor: '#DCECE5', borderRadius: 12, padding: 14, marginTop: 12, backgroundColor: '#FBFDFC' },
  paperEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: REC.primary },
  paperTitle: { fontSize: 19, fontWeight: '800', color: REC.ink, marginBottom: 10 },
  paperRow: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12 },
  half: { flex: 1 },
  fieldTitle: { fontSize: 11.5, fontWeight: '700', color: REC.muted, marginBottom: 3 },
  fieldValue: { fontSize: 13.5, color: REC.ink, lineHeight: 19 },
  medicine: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF3F2' },
  medicineName: { fontSize: 14, fontWeight: '700', color: REC.ink },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
