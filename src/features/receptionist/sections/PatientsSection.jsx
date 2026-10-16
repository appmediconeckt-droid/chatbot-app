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
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../components/TranslatedText';
import { ResponsiveGrid, useResponsiveLayout } from '../../../components/common/ResponsiveLayout';
import {
  AlertBox, Card, CardHeading, Empty, Notice, NoticeText, OptionSheet, REC, RecButton, SelectField, StatTile,
} from '../receptionistUi';
import { apiError, fetchPatientHistory } from '../receptionistApi';
import { clinicName, dateLabel, displayTime, isOrphanedBooking, statusLabel } from '../receptionistUtils';
import { getDoctorMedicines, getDoctorTests, unpackConsultationNotes } from '../../../utils/consultationDetails';
import { downloadVisitPrescriptionPdf } from '../../doctor/dashboard/utils/prescriptionPdf';

const EMPTY = { from: '', to: '', clinic_id: '', source: 'all', search: '' };
const SOURCES = [['all', 'All records'], ['online', 'Online visits'], ['walkin', 'Walk-in visits'], ['prescription', 'Chat prescriptions']];
const PER_PAGE = 10;       // patients shown per page
const FETCH_LIMIT = 50;    // records requested per API page
const MAX_FETCH_PAGES = 40;
const SOURCE_STYLE = {
  walkin: { label: 'Walk-in', icon: 'walk-outline', bg: '#FFF4DF', fg: '#C27C0E' },
  online: { label: 'Online', icon: 'globe-outline', bg: '#E8F1FF', fg: '#3975C7' },
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
  return {
    ...first,
    records: records
      .filter((row) => !isOrphanedBooking(row))
      .filter((row) => row.id == null || (seen.has(row.id) ? false : seen.add(row.id))),
  };
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
  const { isWide } = useResponsiveLayout();
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
          <StatTile title="Patients" value={patients.length} icon="people-outline" tone="teal" tabletColumns={3} />
          <StatTile title="Completed visits" value={data.summary?.visits} icon="calendar-outline" tone="teal" tabletColumns={3} />
          <StatTile title="Treatment records" value={data.summary?.prescriptions} icon="document-text-outline" tone="teal" tabletColumns={3} />
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
        <View style={isWide && s.filterRow}>
        <View style={[s.twoCol, isWide && s.flex]}>
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
        <View style={[s.twoCol, isWide && s.flex]}>
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
        </View>
        <View style={[s.actions, isWide && s.actionsWide]}>
          <RecButton primary label="Apply filters" disabled={loading} onPress={apply} style={[s.flex, isWide && s.applyWide]} />
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
            {shown.length ? <ResponsiveGrid minItemWidth={320}>{shown.map((group) => (
              <PatientCard
                key={group.key}
                group={group}
                doctor={doctorFor(group.latest)}
                onPress={() => { setOpenPatient(group); setSelected(null); setDownloadError(''); }}
              />
            ))}</ResponsiveGrid> : <Empty title="No completed visits or prescriptions found" description="Change your filters or refresh after your doctor completes a consultation." />}
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
                    <Pressable onPress={() => { setSelected(null); setDownloadError(''); }} style={s.close} hitSlop={8} accessibilityLabel="Back to visits">
                      <Ionicons name="arrow-back" size={20} color={REC.ink} />
                    </Pressable>
                  )}
                  <View style={s.flex}>
                    <Text style={s.sheetEyebrow}>VISIT RECORD</Text>
                    <Text translate={false} style={s.rxSheetName} numberOfLines={1}>{selected.patient?.name || 'Patient'}</Text>
                  </View>
                  <Pressable onPress={closeSheet} style={s.close} hitSlop={8} accessibilityLabel="Close">
                    <Ionicons name="close" size={20} color={REC.ink} />
                  </Pressable>
                </View>
                <ScrollView style={s.sheetScroll} contentContainerStyle={s.rxContent} showsVerticalScrollIndicator={false}>
                  <View style={s.rxVisit}>
                    <View style={s.rxVisitTop}>
                      <View style={[s.rxSourceTag, { backgroundColor: sourceStyle(selected.source).bg }]}>
                        <Ionicons name={sourceStyle(selected.source).icon} size={12} color={sourceStyle(selected.source).fg} />
                        <Text translate={false} style={[s.rxSourceText, { color: sourceStyle(selected.source).fg }]}>
                          {selected.source === 'prescription' ? 'Chat consultation' : `${sourceStyle(selected.source).label} checkup`}
                        </Text>
                      </View>
                      {selected.token != null && <Text translate={false} style={s.rxToken}>Token #{selected.token}</Text>}
                    </View>
                    <View style={s.rxInfoGrid}>
                      <RxInfo icon="calendar-outline" label="Date" value={dateLabel(selected.checkedDate)} />
                      <RxInfo icon="time-outline" label="Time" value={selected.checkedAt ? displayTime(selected.checkedAt) : selected.appointmentTime || 'Not recorded'} />
                    </View>
                    <RxInfo icon="medkit-outline" label="Prescribing doctor" value={doctorFor(selected)} wide />
                    <RxInfo
                      icon={selected.source === 'prescription' ? 'chatbubble-ellipses-outline' : 'business-outline'}
                      label={selected.source === 'prescription' ? 'Consultation' : 'Clinic / Hospital'}
                      value={selected.source === 'prescription' ? 'Chat consultation' : clinicName(clinics, selected.clinicId)}
                      wide
                    />
                  </View>

                  {!!selected.symptoms && (
                    <View style={s.rxSymptoms}>
                      <View style={s.rxSymptomsHead}>
                        <Ionicons name="thermometer-outline" size={15} color="#B54708" />
                        <Text style={s.rxSymptomsLabel}>Symptoms reported</Text>
                      </View>
                      <Text translate={false} style={s.rxSymptomsText}>{selected.symptoms}</Text>
                    </View>
                  )}

                  {!selected.hasPrescription && (
                    <Notice icon="alert-circle-outline" iconColor="#C27C0E" style={s.rxNoRx}>
                      <NoticeText>No prescription has been recorded for this visit.</NoticeText>
                    </Notice>
                  )}

                  <View style={s.paper}>
                    <View style={s.paperHead}>
                      <View style={s.rxSymbol}><Text style={s.rxSymbolText}>℞</Text></View>
                      <View style={s.flex}>
                        <Text style={s.paperEyebrow}>CONSULTATION RECORD</Text>
                        <Text style={s.paperTitle}>Prescription</Text>
                      </View>
                      <Text translate={false} style={s.paperDate}>{dateLabel(selected.checkedDate)}</Text>
                    </View>

                    <View style={s.paperPatient}>
                      <RxPair label="Patient" value={selected.patient?.name || 'Patient'} />
                      <RxPair label="Gender" value={rx.gender ? rx.gender.charAt(0).toUpperCase() + rx.gender.slice(1) : '—'} />
                      {selected.patient?.age != null && <RxPair label="Age" value={String(selected.patient.age)} />}
                    </View>

                    <RxSection icon="help-circle-outline" title="Consultation for" value={rx.issue || '—'} />
                    <View style={s.rxDiagnosis}>
                      <Text style={s.rxDiagnosisLabel}>DIAGNOSIS</Text>
                      <Text translate={false} style={s.rxDiagnosisText}>{rx.diagnosis || selected.diagnosis || 'Not recorded'}</Text>
                    </View>

                    <View style={s.rxSectionHead}>
                      <Ionicons name="medical-outline" size={14} color={REC.primary} />
                      <Text style={s.rxSectionTitle}>Prescribed medicines</Text>
                      {rx.medicines.length > 0 && <Text translate={false} style={s.rxCount}>{rx.medicines.length}</Text>}
                    </View>
                    {rx.medicines.length ? rx.medicines.map((m, index) => (
                      <View key={`${m.name}-${index}`} style={s.medicine}>
                        <View style={s.medicineIndex}><Text translate={false} style={s.medicineIndexText}>{index + 1}</Text></View>
                        <View style={s.flex}>
                          <Text translate={false} style={s.medicineName}>{m.name}</Text>
                          <View style={s.medicineChips}>
                            {[m.dosage, m.timings.join(', '), m.duration].filter(Boolean).map((part) => (
                              <Text key={part} translate={false} style={s.medicineChip}>{part}</Text>
                            ))}
                          </View>
                        </View>
                      </View>
                    )) : <Text style={s.rxEmpty}>No medicines prescribed.</Text>}

                    {!!rx.advice && <RxSection icon="chatbox-ellipses-outline" title="Advice & instructions" value={rx.advice} />}
                    {!!rx.notes && rx.notes !== rx.advice && <RxSection icon="create-outline" title="Additional notes" value={rx.notes} />}
                    {rx.tests.length > 0 && (
                      <>
                        <View style={s.rxSectionHead}>
                          <Ionicons name="flask-outline" size={14} color={REC.primary} />
                          <Text style={s.rxSectionTitle}>Recommended tests</Text>
                        </View>
                        <View style={s.medicineChips}>
                          {rx.tests.map((test) => <Text key={test} translate={false} style={s.testChip}>{test}</Text>)}
                        </View>
                      </>
                    )}

                    <View style={s.paperFooter}>
                      <View style={s.flex}>
                        <Text style={s.footerLabel}>Follow-up</Text>
                        <Text translate={false} style={s.footerValue}>
                          {rx.followUp ? dateLabel(rx.followUp) : rx.followUpRequired ? 'Required' : 'Not scheduled'}
                        </Text>
                      </View>
                      <View style={s.signature}>
                        <Text translate={false} style={s.signatureName} numberOfLines={1}>{doctorFor(selected)}</Text>
                        <View style={s.signatureLine} />
                        <Text style={s.footerLabel}>Issued by</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>
                <AlertBox text={downloadError} />
                <View style={s.sheetActions}>
                  <RecButton icon={openPatient ? 'arrow-back' : undefined} label={openPatient ? 'Back to visits' : 'Close'} onPress={() => (openPatient ? setSelected(null) : closeSheet())} style={s.flex} />
                  {selected.hasPrescription && (
                    <RecButton primary icon="download-outline" label={downloading ? 'Downloading...' : 'Download PDF'} disabled={downloading} onPress={download} style={s.flex} />
                  )}
                </View>
              </>
            ) : !!openPatient && (
              <>
                <View style={[s.sheetHead, s.patientSheetHead]}>
                  <View style={[s.avatar, s.avatarLarge]}>
                    <Text translate={false} style={[s.avatarText, s.avatarTextLarge]}>{initials(openPatient.patient.name)}</Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.sheetEyebrow}>PATIENT VISITS</Text>
                    <Text translate={false} style={s.sheetName}>{openPatient.patient.name || 'Patient'}</Text>
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
                {(openPatient.patient.age != null || !!openPatient.patient.gender) && <View style={s.demographics}>
                  <Text translate={false} style={s.muted}>
                    {[openPatient.patient.age != null ? `Age: ${openPatient.patient.age}` : '', openPatient.patient.gender].filter(Boolean).join(' · ')}
                  </Text>
                </View>}
                <View style={s.historyHeading}>
                  <Text style={s.historyTitle}>Visit history</Text>
                  <View style={s.historySort}>
                    <Ionicons name="time-outline" size={13} color={REC.muted} />
                    <Text style={s.historySortText}>Latest first</Text>
                  </View>
                </View>
                <ScrollView style={s.sheetScroll} contentContainerStyle={s.visitsContent} showsVerticalScrollIndicator={false}>
                  <View style={s.vTable}>
                    <View style={s.vHead}>
                      <Text style={[s.vHeadText, s.vColDate]}>DATE</Text>
                      <Text style={[s.vHeadText, s.flex]}>VISIT</Text>
                      <Text style={s.vHeadText}>RX</Text>
                    </View>
                    {openPatient.visits.map((row, index) => (
                      <VisitCard
                        key={row.id}
                        row={row}
                        doctor={doctorFor(row)}
                        when={visitWhen(row)}
                        last={index === openPatient.visits.length - 1}
                        onPress={() => { setSelected(row); setDownloadError(''); }}
                      />
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// One compact table row per visit; tapping it opens the full prescription.
function VisitCard({ row, doctor, when, last, onPress }) {
  const src = sourceStyle(row.source);
  const prescription = readPrescription(row.prescription);
  const date = dateLabel(row.checkedDate || row.checkedAt);
  const [day, month] = date === 'Not recorded' ? ['--', ''] : date.split(' ');
  const time = row.checkedAt ? displayTime(row.checkedAt) : row.appointmentTime || '';
  const diagnosis = row.diagnosis || prescription.diagnosis;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${src.label} visit, ${when}`}
      style={({ pressed }) => [s.vRow, !last && s.vRowDivider, pressed && s.vRowPressed]}
    >
      <View style={[s.vColDate, s.vDate]}>
        <Text translate={false} style={s.vDay}>{day}</Text>
        <Text translate={false} style={s.vMonth}>{month.toUpperCase()}</Text>
      </View>
      <View style={s.flex}>
        <View style={s.vTitleRow}>
          <View style={[s.vTag, { backgroundColor: src.bg }]}>
            <Text translate={false} style={[s.vTagText, { color: src.fg }]}>{src.label}</Text>
          </View>
          {row.token != null && <Text translate={false} style={s.vMeta}>#{row.token}</Text>}
          {!!time && <Text translate={false} style={s.vMeta}>{time}</Text>}
        </View>
        <Text translate={false} style={[s.vDiagnosis, !diagnosis && s.vDiagnosisEmpty]} numberOfLines={1}>
          {diagnosis || 'Diagnosis not recorded'}
        </Text>
        <Text translate={false} style={s.vDoctor} numberOfLines={1}>{doctor}</Text>
      </View>
      <Ionicons
        name={row.hasPrescription ? 'document-text' : 'remove-circle-outline'}
        size={17}
        color={row.hasPrescription ? REC.primary : '#B8C2CC'}
      />
      <Ionicons name="chevron-forward" size={15} color="#A0AEBB" />
    </Pressable>
  );
}

// A compact card per patient: who, last visit, what was found. Tapping it
// opens the full visit history.
function PatientCard({ group, doctor, onPress }) {
  const { patient, visits, latest, counts, prescriptions } = group;
  const diagnosis = latest.diagnosis || latest.prescription?.problem;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View visits for ${patient.name || 'Patient'}`} style={({ pressed }) => [s.patient, pressed && s.patientPressed]}>
      <View style={s.patientAccent} />
      <View style={s.patientTop}>
        <LinearGradient colors={['#12756D', '#25B887']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.patientAvatar}>
          <Text translate={false} style={s.patientAvatarText}>{initials(patient.name)}</Text>
        </LinearGradient>
        <View style={s.flex}>
          <Text translate={false} style={s.patientName} numberOfLines={1}>{patient.name || 'Patient'}</Text>
          <Text translate={false} style={s.phoneText} numberOfLines={1}>
            {patient.phoneNumber || 'No phone'} · {visits.length} {visits.length === 1 ? 'visit' : 'visits'}
          </Text>
        </View>
        <View style={s.patientRight}>
          <Text translate={false} style={s.lastDate}>{dateLabel(latest.checkedDate)}</Text>
          {prescriptions > 0 && (
            <View style={s.rxBadge}>
              <Ionicons name="document-text" size={10} color={REC.primary} />
              <Text translate={false} style={s.rxBadgeText}>{prescriptions} Rx</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.lastVisit}>
        <Ionicons name="pulse" size={13} color={diagnosis ? '#C2410C' : '#94A3B8'} />
        <Text translate={false} style={[s.diagnosis, !diagnosis && s.diagnosisEmpty]} numberOfLines={1}>
          {diagnosis || 'Diagnosis not recorded'}
        </Text>
      </View>
      <View style={s.metaLine}>
        <Ionicons name="medkit-outline" size={12} color={REC.muted} />
        <Text translate={false} style={s.metaText} numberOfLines={1}>{doctor}</Text>
      </View>

      <View style={s.patientFooter}>
        <View style={s.chips}>
          {Object.entries(counts).map(([source, count]) => {
            const src = sourceStyle(source);
            return (
              <View key={source} style={[s.chip, { backgroundColor: src.bg }]}>
                <Ionicons name={src.icon} size={11} color={src.fg} />
                <Text translate={false} style={[s.chipText, { color: src.fg }]}>{count} {src.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={s.patientAction}>
          <Text style={s.openText}>View</Text>
          <Ionicons name="chevron-forward" size={14} color={REC.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function SummaryPill({ value, label }) {
  return (
    <View style={s.summaryPill}>
      <Text translate={false} style={s.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

function RxInfo({ icon, label, value, wide }) {
  return (
    <View style={[s.rxInfo, wide && s.rxInfoWide]}>
      <View style={s.rxInfoIcon}><Ionicons name={icon} size={14} color={REC.primary} /></View>
      <View style={s.flex}>
        <Text style={s.rxInfoLabel}>{label}</Text>
        <Text translate={false} style={s.rxInfoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function RxPair({ label, value }) {
  return (
    <View style={s.rxPair}>
      <Text style={s.footerLabel}>{label}</Text>
      <Text translate={false} style={s.rxPairValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RxSection({ icon, title, value }) {
  return (
    <>
      <View style={s.rxSectionHead}>
        <Ionicons name={icon} size={14} color={REC.primary} />
        <Text style={s.rxSectionTitle}>{title}</Text>
      </View>
      <Text translate={false} style={s.rxSectionText}>{value}</Text>
    </>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 12 },
  actionsWide: { justifyContent: 'flex-end' },
  applyWide: { flex: 0, minWidth: 200 },
  vTable: { borderWidth: 1, borderColor: REC.line, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  vHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F6F8FA', borderBottomWidth: 1, borderBottomColor: REC.line },
  vHeadText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#7C8B9A', marginRight: 18 },
  vColDate: { width: 40 },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#FFFFFF' },
  vRowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F5' },
  vRowPressed: { backgroundColor: '#F3F8F7' },
  vDate: { alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: REC.soft },
  vDay: { fontSize: 15, fontWeight: '800', color: REC.primary, lineHeight: 18 },
  vMonth: { fontSize: 9.5, fontWeight: '700', color: REC.softText, letterSpacing: 0.5 },
  vTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vTag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999 },
  vTagText: { fontSize: 10.5, fontWeight: '700' },
  vMeta: { fontSize: 11.5, fontWeight: '600', color: REC.muted },
  vDiagnosis: { fontSize: 13, fontWeight: '700', color: REC.ink, marginTop: 3 },
  vDiagnosisEmpty: { fontWeight: '500', color: '#94A3B8', fontStyle: 'italic' },
  vDoctor: { fontSize: 11.5, color: REC.muted, marginTop: 1 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  muted: { fontSize: 12.5, color: REC.muted },
  doctor: { fontSize: 14, fontWeight: '700', color: REC.ink },
  count: { fontSize: 11, fontWeight: '600', color: '#728798', backgroundColor: '#F1F5F8', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginHorizontal: 14, marginBottom: 16 },
  search: { height: 44, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 12, backgroundColor: '#FAFBFD' },
  searchInput: { flex: 1, fontSize: 14, color: REC.ink, paddingVertical: 0 },
  twoCol: { flexDirection: 'row', gap: 10 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  warning: { marginTop: 2, marginBottom: 14, backgroundColor: '#FFF8EC', borderColor: '#F6DDAE' },
  pressed: { opacity: 0.75 },

  patient: {
    borderRadius: 16, paddingVertical: 12, paddingRight: 12, paddingLeft: 15, marginBottom: 10, backgroundColor: '#FFFFFF', overflow: 'hidden',
    borderWidth: 1, borderColor: '#E3ECEA',
    shadowColor: '#0F3D38', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  patientPressed: { opacity: 0.85 },
  patientAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: REC.primary },
  patientTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  patientAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BCDAD4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: REC.primary },
  avatarLarge: { width: 56, height: 56, borderRadius: 18 },
  avatarTextLarge: { fontSize: 20 },
  patientName: { fontSize: 15, fontWeight: '800', color: REC.ink },
  phoneText: { fontSize: 11.5, fontWeight: '500', color: REC.muted, marginTop: 1 },
  patientRight: { alignItems: 'flex-end', gap: 3 },
  lastDate: { fontSize: 11.5, fontWeight: '700', color: REC.ink },
  rxBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: REC.soft },
  rxBadgeText: { fontSize: 10.5, fontWeight: '700', color: REC.primary },
  lastVisit: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: '#F6FAF9' },
  diagnosis: { flex: 1, fontSize: 13, fontWeight: '700', color: REC.ink },
  diagnosisEmpty: { fontWeight: '500', color: '#94A3B8', fontStyle: 'italic' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, paddingHorizontal: 2 },
  metaText: { flexShrink: 1, fontSize: 12, color: '#5B6B7B' },
  patientFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700' },
  patientAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { fontSize: 12.5, fontWeight: '700', color: REC.primary },

  pagination: { marginTop: 6, gap: 10 },
  pageButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageNow: { fontSize: 13, fontWeight: '700', color: REC.ink },

  overlay: { flex: 1, backgroundColor: 'rgba(32,50,72,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, height: '90%', maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  patientSheetHead: { paddingVertical: 6 },
  sheetName: { fontSize: 22, fontWeight: '700', color: REC.ink, marginBottom: 3 },
  sheetEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: REC.primary, marginBottom: 3 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', marginTop: 18, borderWidth: 1, borderColor: REC.line, borderRadius: 16, overflow: 'hidden' },
  demographics: { marginTop: 10 },
  summaryPill: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', paddingVertical: 13, paddingHorizontal: 10, alignItems: 'center' },
  summaryValue: { fontSize: 17, lineHeight: 23, fontWeight: '800', color: REC.ink, fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 10.5, color: REC.muted, marginTop: 3, textAlign: 'center' },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 22, marginBottom: 2 },
  historyTitle: { fontSize: 17, fontWeight: '700', color: REC.ink },
  historySort: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historySortText: { fontSize: 11, color: REC.muted },
  visitsContent: { paddingHorizontal: 2, paddingTop: 2, paddingBottom: 16, gap: 16 },
  visitCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6E6', borderRadius: 20, padding: 16, shadowColor: '#173D35', shadowOpacity: 0.05, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  visitCardPressed: { borderColor: REC.primary, opacity: 0.8 },
  visitTop: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 18 },
  visitDateTile: { width: 58, minHeight: 78, paddingVertical: 8, borderWidth: 1, borderTopWidth: 3, borderColor: '#DDE6E6', borderTopColor: REC.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  visitDay: { fontSize: 25, lineHeight: 29, fontWeight: '800', color: REC.primary, fontVariant: ['tabular-nums'] },
  visitMonth: { fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 1, color: REC.ink },
  visitYear: { fontSize: 10, lineHeight: 14, color: REC.muted },
  visitTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: REC.ink },
  visitTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  visitTime: { flexShrink: 1, fontSize: 12, lineHeight: 17, color: REC.muted },
  visitToken: { alignSelf: 'flex-start', borderWidth: 1, borderColor: REC.line, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 8 },
  visitTokenText: { fontSize: 10.5, fontWeight: '600', color: REC.primary },
  visitInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  visitInfoIcon: { width: 30, height: 30, borderWidth: 1, borderColor: REC.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  visitInfoLabel: { fontSize: 10.5, color: REC.muted, marginBottom: 2 },
  visitSub: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: REC.ink },
  visitDiagnosisBox: { borderTopWidth: 1, borderTopColor: REC.line, paddingTop: 14, marginTop: 2 },
  visitDiagnosisLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: REC.muted, marginBottom: 5 },
  visitDiagnosis: { fontSize: 13.5, lineHeight: 20, fontWeight: '600', color: REC.ink },
  visitFooter: { gap: 12, marginTop: 15 },
  visitPrescriptionStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  visitPrescriptionText: { flexShrink: 1, fontSize: 11.5, color: REC.muted },
  prescriptionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A0AEBB' },
  prescriptionDotAvailable: { backgroundColor: REC.primary },
  visitPrescriptionAvailable: { color: REC.primary },
  visitAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: REC.primary },
  visitActionText: { flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },

  visitMeta: { fontSize: 12.5, color: '#4A8875', marginTop: 8 },
  sheetScroll: { flex: 1, minHeight: 0, marginTop: 12 },
  sheetNotice: { marginTop: 4 },
  paperRow: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12 },
  half: { flex: 1 },
  fieldTitle: { fontSize: 11.5, fontWeight: '700', color: REC.muted, marginBottom: 3 },
  fieldValue: { fontSize: 13.5, color: REC.ink, lineHeight: 19 },
  rxSheetName: { fontSize: 20, fontWeight: '800', color: REC.ink },
  rxContent: { paddingBottom: 8 },
  rxVisit: { padding: 13, borderRadius: 16, backgroundColor: '#F3FAF8', borderWidth: 1, borderColor: '#D7EEE8', gap: 10 },
  rxVisitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rxSourceTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  rxSourceText: { fontSize: 12, fontWeight: '700' },
  rxToken: { fontSize: 12, fontWeight: '800', color: REC.primary, backgroundColor: '#FFFFFF', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  rxInfoGrid: { flexDirection: 'row', gap: 10 },
  rxInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  rxInfoWide: { flex: 0 },
  rxInfoIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  rxInfoLabel: { fontSize: 10.5, fontWeight: '700', color: REC.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  rxInfoValue: { fontSize: 13.5, fontWeight: '700', color: REC.ink, marginTop: 1 },
  rxSymptoms: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: '#FFF8EC', borderWidth: 1, borderColor: '#F6DDAE' },
  rxSymptomsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rxSymptomsLabel: { fontSize: 11.5, fontWeight: '800', color: '#B54708', letterSpacing: 0.3 },
  rxSymptomsText: { fontSize: 13.5, lineHeight: 19, color: '#5A3A12' },
  rxNoRx: { marginTop: 12, backgroundColor: '#FFF8EC', borderColor: '#F6DDAE' },
  paper: {
    marginTop: 12, padding: 15, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCECE5',
    shadowColor: '#0F3D38', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  paperHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: REC.primary },
  rxSymbol: { width: 40, height: 40, borderRadius: 12, backgroundColor: REC.primary, alignItems: 'center', justifyContent: 'center' },
  rxSymbolText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  paperEyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.5, color: REC.primary },
  paperTitle: { fontSize: 18, fontWeight: '800', color: REC.ink },
  paperDate: { fontSize: 12, fontWeight: '700', color: REC.muted },
  paperPatient: { flexDirection: 'row', gap: 10, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#F7F9FA' },
  rxPair: { flex: 1, minWidth: 0 },
  rxPairValue: { fontSize: 13.5, fontWeight: '700', color: REC.ink, marginTop: 2 },
  rxSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 5 },
  rxSectionTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: REC.ink, letterSpacing: 0.2 },
  rxSectionText: { fontSize: 13.5, lineHeight: 19, color: '#3F4F5F' },
  rxCount: { fontSize: 11, fontWeight: '800', color: REC.primary, backgroundColor: REC.soft, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  rxDiagnosis: { marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: '#EEF7F4', borderLeftWidth: 3, borderLeftColor: REC.primary },
  rxDiagnosisLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.3, color: REC.primary },
  rxDiagnosisText: { fontSize: 14.5, fontWeight: '800', color: REC.ink, marginTop: 3 },
  medicine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF3F2' },
  medicineIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  medicineIndexText: { fontSize: 11, fontWeight: '800', color: REC.primary },
  medicineName: { fontSize: 14.5, fontWeight: '800', color: REC.ink },
  medicineChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  medicineChip: { fontSize: 11.5, fontWeight: '600', color: '#475467', backgroundColor: '#F2F4F7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  testChip: { fontSize: 12, fontWeight: '700', color: '#6941C6', backgroundColor: '#F3EFFD', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  rxEmpty: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 4 },
  paperFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF3F2' },
  footerLabel: { fontSize: 10.5, fontWeight: '700', color: REC.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  footerValue: { fontSize: 13.5, fontWeight: '700', color: REC.ink, marginTop: 2 },
  signature: { alignItems: 'center', maxWidth: '55%' },
  signatureName: { fontSize: 13.5, fontWeight: '800', color: REC.primary, fontStyle: 'italic' },
  signatureLine: { alignSelf: 'stretch', height: 1, backgroundColor: '#C9D6D3', marginVertical: 4, minWidth: 110 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
