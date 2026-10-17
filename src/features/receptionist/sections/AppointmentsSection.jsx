// All appointments — the web StaffAppointments (receptionist view):
// GET /api/staff/appointments with search / date / status filters, 10 a page,
// re-read every 15s (and on the portal's pull-to-refresh); a receptionist may
// cancel a booking nobody has started.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../components/TranslatedText';
import { ResponsiveGrid, useResponsiveLayout } from '../../../components/common/ResponsiveLayout';
import {
  AlertBox, AppointmentRow, Card, CardHeading, Empty, OptionSheet, PatientDetailsSheet, REC, SelectField,
} from '../receptionistUi';
import { cancelStaffAppointment, apiError, fetchStaffAppointments } from '../receptionistApi';
import { APPOINTMENT_STATUSES, dateLabel, dedupeRows, indiaToday, patientKey, statusLabel } from '../receptionistUtils';
import ListPagination, { LIST_PAGE_SIZE } from '../components/ListPagination';

const EMPTY_FILTERS = { from: '', to: '', status: 'all', search: '' };
const toKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Quick choices in the Status list: today's date with any / completed status.
const TODAY_OPTIONS = { today: 'Today', today_completed: "Today's completed" };
const STATUS_OPTIONS = ['all', ...Object.keys(TODAY_OPTIONS), ...APPOINTMENT_STATUSES.filter((value) => value !== 'all')];
const optionLabel = (value) => (value === 'all' ? 'All statuses' : TODAY_OPTIONS[value] || statusLabel(value));
// The filters as the API takes them ("Today" → today's from / to dates).
const toQuery = (filters) => {
  if (!TODAY_OPTIONS[filters.status]) return filters;
  const today = indiaToday();
  return { ...filters, from: today, to: today, status: filters.status === 'today_completed' ? 'completed' : 'all' };
};

export default function AppointmentsSection({ clinicId, canCancel, refreshKey }) {
  const { isWide } = useResponsiveLayout();
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
      // No API call while the app is in the background; check again later.
      if (AppState?.currentState && AppState.currentState !== 'active') {
        timer = setTimeout(load, 15000);
        return;
      }
      try {
        const result = await fetchStaffAppointments({ ...toQuery(filters), clinic_id: clinicId || '', page, limit: LIST_PAGE_SIZE });
        if (cancelled) return;
        const pages = Math.max(1, Math.ceil((result?.total || 0) / LIST_PAGE_SIZE));
        if (page > pages) {
          setPage(pages);
          return;
        }
        setData(result);
        setError('');
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
  }, [filters, clinicId, page, refresh, refreshKey]);

  const filtersActive = Boolean(filters.from || filters.to || filters.status !== 'all' || search.trim());
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
    setSelected(null);
  };

  const update = (key, value) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      // "Today" sets its own dates: picking it clears the date fields, and
      // picking a date leaves "Today".
      if (key === 'status' && TODAY_OPTIONS[value]) return { ...next, from: '', to: '' };
      if ((key === 'from' || key === 'to') && TODAY_OPTIONS[current.status]) {
        next.status = current.status === 'today_completed' ? 'completed' : 'all';
      }
      return next;
    });
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

  const appointmentRows = dedupeRows(data?.appointments || []);
  const changePage = (next) => {
    setSelected(null);
    setData(null);
    setLoading(true);
    setPage(next);
  };
  const viewPatient = (row, options = {}) => {
    setEditingVitals(options.editVitals === true);
    setSelected(row);
  };

  return (
    <Card>
      <CardHeading
        title="All appointments"
        right={filtersActive ? (
          <Pressable onPress={clearAll} hitSlop={8} style={s.clear} accessibilityLabel="Clear filters">
            <Ionicons name="close-circle-outline" size={15} color="#B42318" />
            <Text style={s.clearText}>Clear filters</Text>
          </Pressable>
        ) : null}
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

      {/* Status (with Today / Today's completed) first, then the date range. */}
      <View style={[s.filters, isWide && s.filterRow]}>
        <View style={isWide && s.flex}>
          <SelectField
            label="Status"
            icon="funnel-outline"
            valueLabel={optionLabel(filters.status)}
            active={filters.status !== 'all'}
            onPress={() => setPicker('status')}
            onClear={() => update('status', 'all')}
          />
        </View>
        <View style={[s.twoCol, isWide && s.datesWide]}>
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
          {appointmentRows.length ? <ResponsiveGrid minItemWidth={350} maxColumns={2}>{appointmentRows.map((row) => (
            <AppointmentRow
              key={patientKey(row)}
              row={row}
              clinics={data.clinics}
              onView={viewPatient}
              onCancel={canCancel ? cancelAppointment : undefined}
              cancelBusy={cancelBusy}
            />
          ))}</ResponsiveGrid> : <Empty title="No matching appointments" description="Select All dates or adjust your status and search filters." />}
          <ListPagination page={page} total={data.total} onPageChange={changePage} disabled={loading} />
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
        options={STATUS_OPTIONS.map((value) => ({ value, label: optionLabel(value) }))}
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
  filterRow: { flexDirection: 'row', gap: 12 },
  datesWide: { flex: 2 },
  flex: { flex: 1, minWidth: 0 },
  muted: { fontSize: 12.5, color: REC.muted },
  search: { height: 44, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 12, backgroundColor: '#FAFBFD' },
  searchInput: { flex: 1, fontSize: 14, color: REC.ink, paddingVertical: 0 },
  twoCol: { flexDirection: 'row', gap: 10 },
  filters: { marginBottom: 2 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  clearText: { fontSize: 12.5, fontWeight: '700', color: '#B42318' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  doctor: { fontSize: 14, fontWeight: '700', color: REC.ink, marginRight: 4 },
  count: { fontSize: 11, fontWeight: '600', color: '#728798', backgroundColor: '#F1F5F8', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
});
