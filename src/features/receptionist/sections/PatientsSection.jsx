// Patients & prescriptions — the web StaffPatientHistory:
// GET /api/staff/patient-history (completed visits + separate prescriptions) with
// search / date / clinic / record-type filters. Every page of records is
// loaded and grouped by patient, so each patient appears once; opening a
// patient lists their visits, and a visit opens its prescription, which can be
// downloaded as the shared prescription PDF.
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { appointmentToDocument } from '../../../utils/consultationPrescriptionDocument';
import ConsultationPrescriptionDocument from '../../../screens/user/Component/UserDashboard/Tab/Prescription/ConsultationPrescriptionDocument';
import { downloadConsultationPrescriptionPdf } from '../../doctor/dashboard/utils/consultationPrescriptionPdf';
import ListPagination, { LIST_PAGE_SIZE } from '../components/ListPagination';
import { formatPhoneNumber } from '../../../utils/countryCodes';

const EMPTY = { from: '', to: '', clinic_id: '', source: 'all', search: '' };
const SOURCES = [['all', 'All records'], ['online', 'Online visits'], ['walkin', 'Walk-in visits'], ['prescription', 'Prescriptions']];
const FETCH_LIMIT = 50;    // records requested per API page
const MAX_FETCH_PAGES = 40;
const SOURCE_STYLE = {
  walkin: { label: 'Walk-in', icon: 'walk-outline', bg: '#FFF4DF', fg: '#C27C0E' },
  online: { label: 'Online', icon: 'globe-outline', bg: '#E8F1FF', fg: '#3975C7' },
  prescription: { label: 'Prescription', icon: 'document-text-outline', bg: '#EFEAFE', fg: '#6A4FC4' },
};
const sourceStyle = (source) => SOURCE_STYLE[source] || { label: statusLabel(source), icon: 'document-text-outline', bg: '#EDF2F7', fg: '#658097' };
// "#3" means token 3 — the API matches the bare number only.
const cleanSearch = (value = '') => value.trim().replace(/^#s*/, '');
const toKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const isRealName = (value) => typeof value === 'string' && value.trim() && !/^doctor$/i.test(value.trim());
const prescriptionDoctorName = (record = {}, fallback) =>
  [fallback, record.psychiatrist?.name, record.psychiatrist?.fullName, record.doctorProfile?.fullName, record.doctorProfile?.name, record.doctor?.name, record.doctor?.fullName,
    record.doctorName, record.doctor_name, record.psychiatristSnapshot?.name, record.counselor?.fullName]
    .find(isRealName)?.trim() || 'Doctor name not recorded';

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

// `refreshKey` changes on the portal's pull-to-refresh, which reloads the list.
export default function PatientsSection({ refreshKey }) {
  const insets = useSafeAreaInsets();
  const requestVersion = useRef(0);
  const { isWide } = useResponsiveLayout();
  const [filters, setFilters] = useState(EMPTY);
  const [query, setQuery] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openPatient, setOpenPatient] = useState(null); // patient group whose visits are listed
  const [openingId, setOpeningId] = useState('');
  const [selected, setSelected] = useState(null);       // visit whose prescription is shown
  const [picker, setPicker] = useState(null); // 'from' | 'to' | 'clinic' | 'source'
  const [downloading, setDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(''); // visit card whose PDF is downloading
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    requestVersion.current += 1;
    setOpeningId('');
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
    return () => { cancelled = true; requestVersion.current += 1; };
  }, [query, refreshKey]);

  const patients = useMemo(() => groupByPatient(data?.records), [data]);
  const pages = Math.max(1, Math.ceil(patients.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  useEffect(() => { setPage(currentPage); }, [currentPage]);

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
  const closeSheet = () => { requestVersion.current += 1; setOpeningId(''); setSelected(null); setOpenPatient(null); };
  const visitWhen = (row) => `${dateLabel(row.checkedDate)} · ${row.checkedAt ? displayTime(row.checkedAt) : row.appointmentTime || 'Time not recorded'}`;

  const onPickDate = (event, date) => {
    const which = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (event?.type === 'dismissed' || !date || !which) return;
    update({ [which]: toKey(date) });
  };

  const openVisit = async row => {
    if (openingId) return;
    const version = ++requestVersion.current;
    setOpeningId(row.id);
    setDownloadError('');
    try {
      const fresh = await fetchAllHistory(query);
      if (version !== requestVersion.current) return;
      const current = fresh.records.find(record => record.id === row.id);
      if (!current) throw new Error('This visit has changed. Refresh history and open it again.');
      setData(fresh);
      setSelected(current);
    } catch (failure) {
      if (version === requestVersion.current) setDownloadError(apiError(failure, failure.message || 'Prescription could not be loaded. Please retry.'));
    } finally {
      if (version === requestVersion.current) setOpeningId('');
    }
  };

  const download = async () => {
    if (!selected) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadConsultationPrescriptionPdf(rx);
    } catch {
      setDownloadError('Prescription PDF could not be downloaded. Please retry.');
    } finally {
      setDownloading(false);
    }
  };

  // Download straight from a visit card in the history list.
  const downloadVisit = async (row) => {
    if (downloadingId) return;
    setDownloadingId(row.id);
    setDownloadError('');
    try {
      await downloadConsultationPrescriptionPdf(rxFor(row));
    } catch {
      setDownloadError('Prescription PDF could not be downloaded. Please retry.');
    } finally {
      setDownloadingId('');
    }
  };

  const shown = patients.slice((currentPage - 1) * LIST_PAGE_SIZE, currentPage * LIST_PAGE_SIZE);
  const clinics = data?.clinics || [];
  const rxFor = (row) => (row ? appointmentToDocument({
    patient: row.patient,
    doctorProfile: row.doctor || data?.doctor,
    clinic: clinics.find(clinic => String(clinic._id || clinic.id) === String(row.clinicId)),
    date: row.checkedDate,
    token: row.token,
    diagnosis: row.diagnosis,
    ...row.prescription,
  }, doctorFor(row)) : null);
  const rx = rxFor(selected);

  return (
    <>
      <Card>
        <CardHeading title="Patients & prescriptions" />
        {!!data && (
          <View style={s.inline}>
            <Ionicons name="medkit-outline" size={17} color={REC.primary} />
            <Text translate={false} style={s.doctor}>{data.doctor?.name || data.doctor?.fullName}</Text>
          </View>
        )}
      </Card>

      {!!data && (
        <View style={s.stats}>
          <StatTile title="Patients" value={patients.length} icon="people-outline" tone="teal" columns={3} />
          <StatTile title="Completed visits" value={data.summary?.visits} icon="calendar-outline" tone="blue" columns={3} />
          <StatTile title="Treatment records" value={data.summary?.prescriptions} icon="document-text-outline" tone="purple" columns={3} />
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
                <NoticeText>Prescriptions are not linked to a clinic. Select All clinics to include them.</NoticeText>
              </Notice>
            )}
            {shown.length ? <ResponsiveGrid minItemWidth={320}>{shown.map((group) => (
              <PatientCard
                key={group.key}
                group={group}
                doctor={doctorFor(group.latest)}
                onPress={() => { setOpenPatient(group); setSelected(null); setDownloadError(''); }}
              />
            ))}</ResponsiveGrid> : <Empty title="No completed visits or prescriptions found" description="Change your filters, or pull down to refresh after your doctor completes a consultation." />}
            <ListPagination page={currentPage} total={patients.length} onPageChange={setPage} disabled={loading} />
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
        {/* The backdrop is a sibling, not a parent, of the sheet: a Pressable
            around the sheet took the touches its ScrollViews need to scroll. */}
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="Close" />
          <View style={[s.sheet, { paddingBottom: 18 + insets.bottom }]}>
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
                <ScrollView style={[s.sheetScroll, s.rxScroll]} contentContainerStyle={s.rxContent} showsVerticalScrollIndicator={false}>
                  <View style={s.rxVisit}>
                    <View style={s.rxVisitTop}>
                      <View style={[s.rxSourceTag, { backgroundColor: sourceStyle(selected.source).bg }]}>
                        <Ionicons name={sourceStyle(selected.source).icon} size={12} color={sourceStyle(selected.source).fg} />
                        <Text translate={false} style={[s.rxSourceText, { color: sourceStyle(selected.source).fg }]}>
                          {selected.source === 'prescription' ? 'Prescription' : `${sourceStyle(selected.source).label} checkup`}
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
                      icon={selected.source === 'prescription' ? 'document-text-outline' : 'business-outline'}
                      label={selected.source === 'prescription' ? 'Record type' : 'Clinic / Hospital'}
                      value={selected.source === 'prescription' ? 'Prescription' : clinicName(clinics, selected.clinicId)}
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

                  {selected.hasPrescription ? (
                    <>
                      <View style={s.rxDocHead}>
                        <View style={s.rxDocIcon}><Ionicons name="document-text-outline" size={16} color={REC.primary} /></View>
                        <View style={s.flex}>
                          <Text style={s.rxDocTitle}>Prescription</Text>
                          <Text style={s.rxDocSub}>Medicines, tests and follow-up for this visit</Text>
                        </View>
                      </View>
                      <ConsultationPrescriptionDocument data={rx} bleed={18} />
                    </>
                  ) : (
                    // An empty prescription page says nothing useful — show why instead.
                    <View style={s.rxEmpty}>
                      <View style={s.rxEmptyIcon}><Ionicons name="document-text-outline" size={26} color="#B54708" /></View>
                      <Text style={s.rxEmptyTitle}>No prescription for this visit</Text>
                      <Text style={s.rxEmptyText}>The doctor did not record medicines, tests or advice for this checkup, so there is nothing to download.</Text>
                    </View>
                  )}
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
                <PatientProfileHeader patient={openPatient.patient} onClose={closeSheet} />
                <View style={s.summaryRow}>
                  <SummaryTile icon="calendar-outline" tone="teal" value={openPatient.visits.length} label={openPatient.visits.length === 1 ? 'Visit' : 'Visits'} />
                  <SummaryTile icon="document-text-outline" tone="purple" value={openPatient.prescriptions} label={openPatient.prescriptions === 1 ? 'Prescription' : 'Prescriptions'} />
                  <SummaryTile icon="time-outline" tone="blue" value={dateLabel(openPatient.latest.checkedDate)} label="Last visit" />
                </View>
                <AlertBox text={downloadError} />
                <View style={s.historyHeading}>
                  <View style={s.historyIcon}>
                    <Ionicons name="time" size={16} color={REC.primary} />
                  </View>
                  <View style={s.flex}>
                    <View style={s.historyTitleRow}>
                      <Text style={s.historyTitle}>Visit history</Text>
                      <View style={s.historyCount}>
                        <Text translate={false} style={s.historyCountText}>{openPatient.visits.length}</Text>
                      </View>
                    </View>
                    <Text style={s.historyHint}>Latest visit first</Text>
                  </View>
                </View>
                <ScrollView style={s.sheetScroll} contentContainerStyle={s.visitsContent} showsVerticalScrollIndicator={false}>
                  {openPatient.visits.map((row, index) => (
                    <VisitCard
                      key={row.id}
                      latest={index === 0}
                      row={row}
                      doctor={doctorFor(row)}
                      clinic={row.source === 'prescription' ? '' : clinicName(clinics, row.clinicId)}
                      when={visitWhen(row)}
                      onView={() => openVisit(row)}
                      onDownload={() => downloadVisit(row)}
                      opening={openingId === row.id}
                      downloading={downloadingId === row.id}
                      disabled={Boolean(openingId || downloadingId)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// Who the visits belong to: avatar, name, phone and age / gender.
function PatientProfileHeader({ patient, onClose }) {
  const phone = formatPhoneNumber(patient.phoneNumber || patient.phone, patient.phoneCountryCode);
  const facts = [
    patient.age != null && patient.age !== '' ? `${patient.age} yrs` : '',
    patient.gender ? statusLabel(patient.gender) : '',
  ].filter(Boolean);
  return (
    <View style={s.profile}>
      <LinearGradient colors={['#12756D', '#25B887']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.profileAvatar}>
        <Text translate={false} style={s.profileAvatarText}>{initials(patient.name)}</Text>
      </LinearGradient>
      <View style={s.flex}>
        <Text style={s.sheetEyebrow}>PATIENT VISITS</Text>
        <Text translate={false} style={s.sheetName} numberOfLines={1}>{patient.name || 'Patient'}</Text>
        <View style={s.profileFacts}>
          <View style={s.profileFact}>
            <Ionicons name="call-outline" size={12} color={REC.muted} />
            <Text translate={false} style={s.profileFactText}>{phone || 'Phone not recorded'}</Text>
          </View>
          {facts.map((fact) => (
            <View key={fact} style={s.profileChip}>
              <Text translate={false} style={s.profileChipText}>{fact}</Text>
            </View>
          ))}
        </View>
      </View>
      <Pressable onPress={onClose} style={s.close} hitSlop={8} accessibilityLabel="Close">
        <Ionicons name="close" size={20} color={REC.ink} />
      </Pressable>
    </View>
  );
}

// A compact card per visit: date, time, token and visit type; the diagnosis
// only when the doctor recorded one; doctor and clinic; then View / Download
// prescription. View opens the full prescription.
function VisitCard({ row, latest, doctor, clinic, when, onView, onDownload, opening, downloading, disabled }) {
  const src = sourceStyle(row.source);
  const prescription = appointmentToDocument(row.prescription);
  const date = dateLabel(row.checkedDate || row.checkedAt);
  const time = row.checkedAt ? displayTime(row.checkedAt) : row.appointmentTime || '';
  // The prescription document fills a missing diagnosis with "—"; that is no diagnosis.
  const diagnosis = [row.diagnosis, prescription.diagnosis]
    .map((value) => String(value || '').trim())
    .find((value) => value && !/^(—|-+|n\/?a|not recorded)$/i.test(value)) || '';
  const kind = row.source === 'prescription' ? 'Prescription' : `${src.label} visit`;
  const sub = [kind, time, row.token != null ? `Token #${row.token}` : ''].filter(Boolean).join('  ·  ');
  const clinicShown = clinic && clinic !== 'Unassigned' ? clinic : '';
  return (
    <View style={[s.visitCard, latest && s.visitCardLatest]}>
      <View style={[s.visitAccent, { backgroundColor: src.fg }]} />
      <View style={s.visitTop}>
        <View style={[s.visitIcon, { backgroundColor: src.bg }]}>
          <Ionicons name={src.icon} size={17} color={src.fg} />
        </View>
        <View style={s.flex}>
          <View style={s.visitTitleRow}>
            <Text translate={false} style={s.visitDate} numberOfLines={1}>{date === 'Not recorded' ? 'Date not recorded' : date}</Text>
            {latest && (
              <View style={s.latestBadge}>
                <Text style={s.latestText}>LATEST</Text>
              </View>
            )}
          </View>
          <Text translate={false} style={s.visitSub} numberOfLines={1}>{sub}</Text>
        </View>
      </View>

      {!!diagnosis && (
        <View style={s.dxBox}>
          <Ionicons name="pulse" size={14} color="#C2410C" />
          <View style={s.flex}>
            <Text style={s.dxLabel}>DIAGNOSIS</Text>
            <Text translate={false} style={s.dxText} numberOfLines={2}>{diagnosis}</Text>
          </View>
        </View>
      )}

      <View style={s.visitPeople}>
        <View style={s.visitMetaRow}>
          <Ionicons name="person-circle-outline" size={14} color={REC.muted} />
          <Text translate={false} style={s.visitMetaText} numberOfLines={1}>{doctor}</Text>
        </View>
        {!!clinicShown && (
          <View style={s.visitMetaRow}>
            <Ionicons name="business-outline" size={13} color={REC.muted} />
            <Text translate={false} style={s.visitMetaText} numberOfLines={1}>{clinicShown}</Text>
          </View>
        )}
      </View>

      {row.hasPrescription ? (
        <View style={s.visitActions}>
          <Pressable
            onPress={onView}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`View ${src.label} visit prescription, ${when}`}
            style={({ pressed }) => [s.visitBtn, pressed && s.visitBtnPressed, disabled && !opening && s.visitBtnDisabled]}
          >
            {opening
              ? <ActivityIndicator size="small" color={REC.primary} />
              : <Ionicons name="eye-outline" size={14} color={REC.primary} />}
            <Text style={s.visitBtnText}>View prescription</Text>
          </Pressable>
          <Pressable
            onPress={onDownload}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Download ${src.label} visit prescription, ${when}`}
            style={({ pressed }) => [s.visitBtn, s.visitBtnPrimary, pressed && s.visitBtnPrimaryPressed, disabled && !downloading && s.visitBtnDisabled]}
          >
            {downloading
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="download-outline" size={14} color="#FFFFFF" />}
            <Text style={[s.visitBtnText, s.visitBtnTextPrimary]}>{downloading ? 'Downloading...' : 'Download'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.noRx}>
          <Ionicons name="document-outline" size={14} color="#94A3B8" />
          <Text style={s.noRxText}>No prescription was written for this visit</Text>
        </View>
      )}
    </View>
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
            {formatPhoneNumber(patient.phoneNumber || patient.phone, patient.phoneCountryCode) || 'No phone'} · {visits.length} {visits.length === 1 ? 'visit' : 'visits'}
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
                <Text translate={false} style={[s.chipText, { color: src.fg }]}>
                  {count} {source === 'prescription' && count !== 1 ? 'Prescriptions' : src.label}
                </Text>
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

const TILE_TONES = {
  teal: { bg: '#E7F4EE', fg: REC.primary },
  purple: { bg: '#EFEAFE', fg: '#6A4FC4' },
  blue: { bg: '#E8F1FF', fg: '#3975C7' },
};

function SummaryTile({ icon, tone, value, label }) {
  const look = TILE_TONES[tone] || TILE_TONES.teal;
  return (
    <View style={s.summaryTile}>
      <View style={[s.summaryIcon, { backgroundColor: look.bg }]}>
        <Ionicons name={icon} size={15} color={look.fg} />
      </View>
      <Text translate={false} style={s.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={s.summaryLabel} numberOfLines={1}>{label}</Text>
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

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 12 },
  actionsWide: { justifyContent: 'flex-end' },
  applyWide: { flex: 0, minWidth: 200 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  muted: { fontSize: 12.5, color: REC.muted },
  doctor: { fontSize: 14, fontWeight: '700', color: REC.ink },
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


  overlay: { flex: 1, backgroundColor: 'rgba(32,50,72,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, height: '90%', maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetName: { fontSize: 20, fontWeight: '800', color: REC.ink, marginBottom: 4 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: REC.line },
  profileAvatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
  profileFacts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  profileFact: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 },
  profileFactText: { fontSize: 12.5, fontWeight: '600', color: '#4B5B6B' },
  profileChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: REC.line },
  profileChipText: { fontSize: 11, fontWeight: '700', color: '#4B5B6B' },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 },
  summaryTile: { flex: 1, minWidth: 0, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#FAFCFC', borderWidth: 1, borderColor: REC.line },
  summaryIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryValue: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: REC.ink, fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: REC.muted, marginTop: 1 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 2 },
  historyIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { fontSize: 16.5, fontWeight: '800', color: REC.ink },
  historyCount: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: REC.primary, alignItems: 'center' },
  historyCountText: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' },
  historyHint: { fontSize: 11.5, color: REC.muted, marginTop: 1 },
  visitsContent: { paddingHorizontal: 2, paddingTop: 4, paddingBottom: 18 },
  visitCard: {
    marginBottom: 12, paddingLeft: 16, paddingRight: 13, paddingVertical: 13, borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E3EBEA', overflow: 'hidden',
    shadowColor: '#0F3D38', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  visitCardLatest: { borderColor: '#A8D8CC' },
  visitAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  visitTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  visitIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  visitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  visitDate: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: REC.ink },
  visitSub: { fontSize: 12, fontWeight: '600', color: REC.muted, marginTop: 2 },
  latestBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: '#E1F5EE', borderWidth: 1, borderColor: '#A8D8CC' },
  latestText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: REC.primary },
  dxBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 11, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF6EE', borderWidth: 1, borderColor: '#FBE0C8' },
  dxLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: '#C2410C' },
  dxText: { fontSize: 13.5, lineHeight: 18, fontWeight: '700', color: '#3B2A1E', marginTop: 1 },
  visitPeople: { marginTop: 10, gap: 4 },
  visitMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitMetaText: { flexShrink: 1, fontSize: 12.5, fontWeight: '500', color: '#4B5B6B' },
  visitActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F5' },
  visitBtn: {
    flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 11, borderWidth: 1, borderColor: '#BFDDD6', backgroundColor: '#FFFFFF', paddingHorizontal: 8,
  },
  visitBtnPressed: { backgroundColor: REC.soft },
  visitBtnPrimary: { backgroundColor: REC.primary, borderColor: REC.primary },
  visitBtnPrimaryPressed: { backgroundColor: REC.primaryDark },
  visitBtnDisabled: { opacity: 0.5 },
  visitBtnText: { fontSize: 12.5, fontWeight: '700', color: REC.primary },
  visitBtnTextPrimary: { color: '#FFFFFF' },
  noRx: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D5DDE5', backgroundColor: '#F8FAFB' },
  noRxText: { fontSize: 12, fontWeight: '600', color: '#7C8B9A' },
  sheetEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: REC.primary, marginBottom: 3 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line, alignItems: 'center', justifyContent: 'center' },

  sheetScroll: { flex: 1, minHeight: 0, marginTop: 12 },
  // Full-bleed scroll: the sheet's side padding moves inside, so the
  // prescription page can spread to the edges without being clipped.
  rxScroll: { marginHorizontal: -18 },
  sheetNotice: { marginTop: 4 },
  paperRow: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12 },
  half: { flex: 1 },
  fieldTitle: { fontSize: 11.5, fontWeight: '700', color: REC.muted, marginBottom: 3 },
  fieldValue: { fontSize: 13.5, color: REC.ink, lineHeight: 19 },
  rxSheetName: { fontSize: 20, fontWeight: '800', color: REC.ink },
  rxContent: { paddingBottom: 20, paddingHorizontal: 18 },
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
  rxDocHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 12 },
  rxDocIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E8F6F2', alignItems: 'center', justifyContent: 'center' },
  rxDocTitle: { fontSize: 16, fontWeight: '800', color: REC.ink },
  rxDocSub: { fontSize: 12, color: REC.muted, marginTop: 1 },
  rxEmpty: { marginTop: 18, alignItems: 'center', paddingVertical: 26, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#F6DDAE', backgroundColor: '#FFFBF3' },
  rxEmptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  rxEmptyTitle: { fontSize: 15.5, fontWeight: '800', color: '#7A2E0E', textAlign: 'center' },
  rxEmptyText: { fontSize: 13, lineHeight: 19, color: '#93370D', textAlign: 'center', marginTop: 6 },
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
  paperFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF3F2' },
  footerLabel: { fontSize: 10.5, fontWeight: '700', color: REC.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  footerValue: { fontSize: 13.5, fontWeight: '700', color: REC.ink, marginTop: 2 },
  signature: { alignItems: 'center', maxWidth: '55%' },
  signatureName: { fontSize: 13.5, fontWeight: '800', color: REC.primary, fontStyle: 'italic' },
  signatureLine: { alignSelf: 'stretch', height: 1, backgroundColor: '#C9D6D3', marginVertical: 4, minWidth: 110 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
