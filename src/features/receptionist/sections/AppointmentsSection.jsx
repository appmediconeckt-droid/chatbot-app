// All appointments — the web StaffAppointments (receptionist view):
// GET /api/staff/appointments with search / date / status filters, 10 a page,
// re-read every 15s; a receptionist may cancel a booking nobody has started.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../components/TranslatedText';
import {
  AlertBox, AppointmentRow, Card, CardHeading, Empty, OptionSheet, PatientDetailsSheet, REC, RecButton, SelectField,
} from '../receptionistUi';
import { cancelStaffAppointment, apiError, fetchStaffAppointments } from '../receptionistApi';
import { APPOINTMENT_STATUSES, dateLabel, dedupeRows, indiaToday, patientKey, statusLabel } from '../receptionistUtils';

const EMPTY_FILTERS = { from: '', to: '', status: 'all', search: '' };
const toKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function AppointmentsSection({ clinicId, canCancel, compact }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(null);
  const [editingVitals, setEditingVitals] = useState(false);
  const [cancelBusy, setCancelBusy] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [picker, setPicker] = useState(null); // 'from' | 'to' | 'status'

  // Search is applied after a short pause in typing.
  const searchTimer = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((current) => (current.search === search ? current : { ...current, search }));
      setPage(1);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => { setPage(1); setSelected(null); }, [clinicId]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    setLoading(true);
    setError('');
    if (filters.from && filters.to && filters.from > filters.to) {
      setError('Start date must be before end date.');
      setLoading(false);
      return () => { cancelled = true; };
    }
    const load = async () => {
      try {
        const result = await fetchStaffAppointments({ ...filters, clinic_id: clinicId || '', page, limit: 10 });
        if (cancelled) return;
        setData(result);
        setError('');
        const pages = Math.max(1, Math.ceil((result?.total || 0) / 10));
        if (page > pages) setPage(pages);
      } catch (err) {
        if (cancelled) return;
        setError(apiError(err, 'Appointments could not be loaded. Please refresh.'));
        if ([401, 403, 404].includes(err?.response?.status)) setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(load, 15000);
        }
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, clinicId, page, refresh]);

  const filtersActive = Boolean(filters.from || filters.to || filters.status !== 'all' || search.trim());
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
    setSelected(null);
  };

  const update = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSelected(null);
  };

  const cancelAppointment = (row) => {
    if (cancelBusy || !canCancel) return;
    Alert.alert('Cancel appointment', `Cancel the appointment for ${row.patientName}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel appointment',
        style: 'destructive',
        onPress: async () => {
          setCancelBusy(patientKey(row));
          setCancelError('');
          try {
            await cancelStaffAppointment(row);
            setSelected(null);
            setRefresh((value) => value + 1);
          } catch (err) {
            setCancelError(apiError(err, 'Appointment could not be cancelled. Please try again.'));
            if (err?.response?.status === 409) setRefresh((value) => value + 1);
          } finally {
            setCancelBusy('');
          }
        },
      },
    ]);
  };

  const onPickDate = (event, date) => {
    const which = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (event?.type === 'dismissed' || !date || !which) return;
    update(which, toKey(date));
  };

  const pages = Math.max(1, Math.ceil((data?.total || 0) / 10));
  const first = data?.total ? (page - 1) * 10 + 1 : 0;
  const last = Math.min(page * 10, data?.total || 0);
  const appointmentRows = dedupeRows(data?.appointments || []);
  const viewPatient = (row, options = {}) => {
    setEditingVitals(options.editVitals === true);
    setSelected(row);
  };

  return (
    <Card>
      <CardHeading
        title="All appointments"
        right={<RecButton compact icon="refresh" disabled={loading} onPress={() => setRefresh((value) => value + 1)} />}
      />

      <View style={s.search}>
        <Ionicons name="search" size={18} color={REC.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          style={s.searchInput}
          placeholder="Search patient, phone or token..."
          placeholderTextColor="#94A3B8"
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={REC.muted} />
          </Pressable>
        )}
      </View>

      <View style={s.twoCol}>
        <View style={s.flex}>
          <SelectField
            label="From date"
            icon="calendar-outline"
            valueLabel={filters.from ? dateLabel(filters.from) : 'Any date'}
            active={Boolean(filters.from)}
            onPress={() => setPicker('from')}
            onClear={() => update('from', '')}
          />
        </View>
        <View style={s.flex}>
          <SelectField
            label="To date"
            icon="calendar-outline"
            valueLabel={filters.to ? dateLabel(filters.to) : 'Any date'}
            active={Boolean(filters.to)}
            onPress={() => setPicker('to')}
            onClear={() => update('to', '')}
          />
        </View>
      </View>
      <SelectField
        label="Status"
        icon="funnel-outline"
        valueLabel={filters.status === 'all' ? 'All statuses' : statusLabel(filters.status)}
        active={filters.status !== 'all'}
        onPress={() => setPicker('status')}
        onClear={() => update('status', 'all')}
      />

      <View style={s.quick}>
        <RecButton compact icon="today-outline" label="Today" onPress={() => { const today = indiaToday(); setFilters((current) => ({ ...current, from: today, to: today })); setPage(1); setSelected(null); }} />
        <RecButton compact icon="checkmark-done-outline" label="Completed" onPress={() => update('status', 'completed')} />
        {filtersActive && (
          <RecButton compact danger icon="close-circle-outline" label="Clear filters" onPress={clearAll} />
        )}
      </View>

      <AlertBox text={error} />
      <AlertBox text={cancelError} />

      {loading && !data ? (
        <View style={s.loading}><ActivityIndicator color={REC.primary} /><Text style={s.muted}>Loading appointments...</Text></View>
      ) : data && (
        <>
          <View style={s.summary}>
            <Text translate={false} style={s.doctor} numberOfLines={1}>{data.doctor?.fullName}</Text>
            <Text translate={false} style={s.count}>{data.total} appointments</Text>
            <Text translate={false} style={s.count}>{data.completed} completed</Text>
          </View>
          {appointmentRows.length ? appointmentRows.map((row) => (
            <AppointmentRow
              key={patientKey(row)}
              row={row}
              clinics={data.clinics}
              compact={compact}
              onView={viewPatient}
              onCancel={canCancel ? cancelAppointment : undefined}
              cancelBusy={cancelBusy}
            />
          )) : <Empty title="No matching appointments" description="Select All dates or adjust your status and search filters." />}
          <View style={s.pagination}>
            <Text translate={false} style={s.muted}>Showing {first}-{last} of {data.total}</Text>
            <View style={s.pageButtons}>
              <RecButton compact icon="chevron-back" label="Previous" disabled={page === 1} onPress={() => setPage((value) => value - 1)} />
              <Text translate={false} style={s.pageNow}>{page} / {pages}</Text>
              <Pressable disabled={page >= pages} onPress={() => setPage((value) => value + 1)} style={[s.nextButton, page >= pages && s.disabled]}>
                <Text style={s.nextText}>Next</Text>
                <Ionicons name="chevron-forward" size={14} color={REC.ink} />
              </Pressable>
            </View>
          </View>
        </>
      )}

      {(picker === 'from' || picker === 'to') && (
        <DateTimePicker
          value={filters[picker] ? new Date(`${filters[picker]}T00:00:00`) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPickDate}
        />
      )}
      <OptionSheet
        visible={picker === 'status'}
        title="Status"
        value={filters.status}
        options={APPOINTMENT_STATUSES.map((value) => ({ value, label: value === 'all' ? 'All statuses' : statusLabel(value) }))}
        onSelect={(value) => update('status', value)}
        onClose={() => setPicker(null)}
      />

      <PatientDetailsSheet
        patient={selected ? appointmentRows.find((row) => patientKey(row) === patientKey(selected)) || selected : null}
        editVitals={editingVitals}
        clinics={data?.clinics || []}
        doctorName={data?.doctor?.fullName}
        onClose={() => setSelected(null)}
        onCancel={canCancel ? cancelAppointment : undefined}
        cancelBusy={cancelBusy}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  muted: { fontSize: 12.5, color: REC.muted },
  search: { height: 44, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 12, backgroundColor: '#FAFBFD' },
  searchInput: { flex: 1, fontSize: 14, color: REC.ink, paddingVertical: 0 },
  twoCol: { flexDirection: 'row', gap: 10 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  doctor: { fontSize: 14, fontWeight: '700', color: REC.ink, marginRight: 4 },
  count: { fontSize: 11, fontWeight: '600', color: '#728798', backgroundColor: '#F1F5F8', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  pagination: { marginTop: 6, gap: 10 },
  pageButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageNow: { fontSize: 13, fontWeight: '700', color: REC.ink },
  nextButton: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D8E1E8', backgroundColor: '#FFFFFF' },
  nextText: { fontSize: 12, fontWeight: '700', color: REC.ink },
  disabled: { opacity: 0.5 },
});
