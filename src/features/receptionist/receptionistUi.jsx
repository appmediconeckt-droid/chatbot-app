// Shared look of the receptionist portal — the web portal's rec-* styles
// (ReceptionistPortal.css) as React Native components.
import React, { useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../components/TranslatedText';
import { ResponsiveGrid, useContentDimensions, useResponsiveLayout } from '../../components/common/ResponsiveLayout';
import { toImageUri } from '../../utils/imageUri';
import { API_BASE_URL } from '../../axiosConfig';
import useKeyboardAwareScroll from '../../hooks/useKeyboardAwareScroll';
import { QUEUE_TABS, appointmentStatuses, canCancelAppointment, canRecordVitals, clinicName, clockLabel, dateLabel, displayTime, emergencyReasonOf, patientKey, statusLabel } from './receptionistUtils';
import { getDoctorMedicines, getDoctorTests, unpackConsultationNotes } from '../../utils/consultationDetails';
import { saveStaffAppointmentVitals } from './receptionistApi';
import { useReceptionistVitals } from './ReceptionistVitalsContext';
import { formatPhoneNumber } from '../../utils/countryCodes';
import VitalsForm, { VITAL_FIELDS, canonicalVitals, hasVital } from '../../components/VitalsForm';

export const REC = {
  primary: '#12756D',
  primaryDark: '#0A615A',
  ink: '#213547',
  muted: '#728092',
  line: '#E6ECF0',
  bg: '#FFFFFF',
  soft: '#E7F4EE',
  softText: '#0C7166',
  green: '#25B887',
  amber: '#E39520',
};

const TONES = {
  blue: { bg: '#E8F1FF', fg: '#3975C7', border: '#C9DCF7' },
  amber: { bg: '#FFF4DF', fg: '#D08A16', border: '#F6DDAE' },
  teal: { bg: '#E3F6F2', fg: '#12756D', border: '#B7E4DA' },
  green: { bg: '#E9F6E9', fg: '#3E8E41', border: '#C5E6C6' },
  red: { bg: '#FFF0F0', fg: '#C24848', border: '#F4C9C9' },
  // Same hue as the "Prescription" record tag.
  purple: { bg: '#F3EFFD', fg: '#6A4FC4', border: '#DDD3F8' },
};

const BADGES = {
  confirmed: { bg: '#E9F6ED', fg: '#499865' },
  completed: { bg: '#E9F6ED', fg: '#499865' },
  complete: { bg: '#E9F6ED', fg: '#499865' },
  in_progress: { bg: '#E4F3F1', fg: '#168B7B' },
  called: { bg: '#E4F3F1', fg: '#168B7B' },
  waiting: { bg: '#FFF5DF', fg: '#B38939' },
  pending: { bg: '#FFF5DF', fg: '#B38939' },
  canceled: { bg: '#FFF0F0', fg: '#C16262' },
  cancelled: { bg: '#FFF0F0', fg: '#C16262' },
  rejected: { bg: '#FFF0F0', fg: '#C16262' },
  no_show: { bg: '#FFF0F0', fg: '#C16262' },
  emergency: { bg: '#FFF0F0', fg: '#C16262' },
};

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function CardHeading({ title, subtitle, right, count }) {
  return (
    <View style={s.cardHeading}>
      <View style={s.flex}>
        <View style={s.row}>
          <Text style={s.cardTitle}>{title}</Text>
          {count != null && <Text translate={false} style={s.count}>{count}</Text>}
        </View>
        {!!subtitle && <Text style={s.cardSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Eyebrow({ children, style }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

export function Badge({ value, emergency = false }) {
  const tone = BADGES[emergency ? 'emergency' : String(value || '').toLowerCase()] || { bg: '#EDF2F7', fg: '#658097' };
  return (
    <View style={[s.badge, { backgroundColor: tone.bg }]}>
      <Text style={[s.badgeText, { color: tone.fg }]}>{emergency ? 'Emergency' : statusLabel(value)}</Text>
    </View>
  );
}

export function LiveLabel({ text, warning }) {
  return (
    <View style={s.row}>
      <View style={[s.dot, warning && s.dotWarning]} />
      <Text translate={false} style={s.liveLabel}>{text}</Text>
    </View>
  );
}

export function DetailFields({ fields }) {
  const { isTablet } = useResponsiveLayout();
  return (
    <View style={s.detailGrid}>
      {fields.map(([title, value, fullWidth]) => {
        const shown = Array.isArray(value) ? value.join(', ') : value;
        return (
          <View key={title} style={[s.detailItem, isTablet && { width: '33.33%' }, fullWidth && s.detailItemFull]}>
            <Text style={s.detailTitle}>{title}</Text>
            <Text translate={false} style={s.detailValue}>
              {shown === undefined || shown === null || shown === '' ? 'Not provided' : String(shown)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function EmergencyReason({ row }) {
  if (!row?.emergency) return null;
  return (
    <View style={s.emergencyReason}>
      <Text style={s.emergencyReasonLabel}>Emergency reason</Text>
      <Text translate={false} style={s.emergencyReasonText}>{emergencyReasonOf(row) || 'Not recorded'}</Text>
    </View>
  );
}

// Read-only: only the readings that were actually recorded, as tiles.
function PatientVitalsView({ patient }) {
  const values = canonicalVitals(patient?.vitals);
  const recorded = VITAL_FIELDS.filter(([key]) => hasVital(values[key]));
  return (
    <View style={s.vitalsCard}>
      <View style={s.vitalsHeader}>
        <View style={s.vitalsIcon}><Ionicons name="pulse" size={16} color={REC.primary} /></View>
        <View style={s.flex}>
          <Text style={s.vitalsTitle}>Patient vitals</Text>
          <Text style={s.vitalsSub}>{recorded.length ? `${recorded.length} ${recorded.length === 1 ? 'reading' : 'readings'} recorded` : 'No measurements recorded yet'}</Text>
        </View>
      </View>
      {recorded.length > 0 ? (
        <View style={s.vitalsGrid}>
          {recorded.map(([key, label, , unit, accent]) => (
            <View key={key} style={s.vitalTile}>
              <View style={[s.vitalTileAccent, { backgroundColor: accent }]} />
              <Text style={s.vitalTileLabel}>{label}</Text>
              <Text translate={false} style={s.vitalTileValue}>
                {String(values[key]).trim()}
                <Text translate={false} style={s.vitalTileUnit}>{/^[/°%]/.test(unit) ? unit : ` ${unit}`}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.vitalsEmpty}>Vitals measured at the front desk before the checkup will appear here.</Text>
      )}
      {hasVital(values.notes) && (
        <View style={s.vitalsNotesBox}>
          <Text style={s.vitalsNotesLabel}>Notes</Text>
          <Text translate={false} style={s.vitalsNotes}>{values.notes}</Text>
        </View>
      )}
    </View>
  );
}

// The Add / Edit vitals form — on its own, with nothing else in the sheet.
// The parent keys it by appointment, so polling never clears what is typed.
function PatientVitalsForm({ patient, onInputFocus, onSaved, onBusyChange }) {
  const { recordVitals } = useReceptionistVitals();
  if (!patient?.id || !canRecordVitals(patient)) {
    return (
      <View style={s.vitalsLocked}>
        <Ionicons name="lock-closed-outline" size={18} color={REC.muted} />
        <Text style={s.vitalsLockedText}>Vitals are read-only after the visit is started or completed.</Text>
      </View>
    );
  }
  return (
    <VitalsForm
      initialVitals={patient.vitals}
      color={REC.primary}
      onInputFocus={onInputFocus}
      onBusyChange={onBusyChange}
      onSubmit={async (draft) => {
        const { data } = await saveStaffAppointmentVitals(patient, draft);
        recordVitals(patient, data.vitals);
        onSaved?.();
      }}
    />
  );
}

export function Empty({ title = 'No patients here yet', description = 'Appointments will appear here when they are booked.', icon = 'people-outline' }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={30} color="#8B9AA9" />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{description}</Text>
    </View>
  );
}

export function LoadingCard({ error, text = 'Loading appointments for your doctor...' }) {
  return (
    <Card style={s.loadingCard}>
      {!error && <ActivityIndicator color={REC.primary} />}
      <Text style={s.loadingText}>{error ? 'Data is unavailable. Use Refresh to try again.' : text}</Text>
    </Card>
  );
}

export function AlertBox({ text }) {
  if (!text) return null;
  return <Text translate={false} style={s.alert}>{text}</Text>;
}

export function Notice({ icon = 'information-circle-outline', children, success, style, iconColor }) {
  return (
    <View style={[s.notice, success && s.noticeSuccess, style]}>
      <Ionicons name={icon} size={18} color={iconColor || (success ? '#328467' : '#6C8396')} />
      <View style={s.flex}>{children}</View>
    </View>
  );
}

export function NoticeText({ children, strong, translate }) {
  return <Text translate={translate} style={[s.noticeText, strong && s.noticeStrong]}>{children}</Text>;
}

// Use the measured card container and allow more room when system text is enlarged.
export function StatGrid({ children }) {
  const { fontScale } = useContentDimensions();
  return (
    <ResponsiveGrid minItemWidth={145 * Math.max(1, fontScale)} maxColumns={4} gap={10} style={s.statGrid}>
      {children}
    </ResponsiveGrid>
  );
}

// `columns={3}`: a row of exactly three tiles — kept on one line on phones
// too, so the third tile never sits alone under the other two.
export function StatTile({ title, value, icon, tone = 'blue', columns, fluid = false }) {
  const t = TONES[tone] || TONES.blue;
  const { width } = useResponsiveLayout();
  const three = columns === 3;
  const tileWidth = three ? '32%' : width >= 720 ? '23.5%' : '48.5%';
  if (three) {
    // Narrow three-up tile: icon, figure and label stacked and centred.
    return (
      <View style={[s.stat, s.statThree, { borderColor: t.border, width: tileWidth }]}>
        <View style={[s.statThreeAccent, { backgroundColor: t.fg }]} />
        <View style={[s.statThreeIcon, { backgroundColor: t.bg }]}>
          <Ionicons name={icon} size={19} color={t.fg} />
        </View>
        <Text
          translate={false}
          style={[s.statThreeValue, { color: t.fg }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value ?? 0}
        </Text>
        <Text style={s.statThreeTitle} numberOfLines={2}>{title}</Text>
      </View>
    );
  }
  return (
    <View style={[
      s.stat,
      { borderColor: t.border, backgroundColor: t.bg },
      fluid ? s.statFluid : { width: tileWidth },
    ]}>
      <View style={s.statTop}>
        <View style={[s.statIcon, { backgroundColor: t.fg }]}>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        </View>
        <Text
          translate={false}
          style={[s.statValue, { color: t.fg }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value ?? 0}
        </Text>
      </View>
      <Text style={s.statTitle} numberOfLines={2}>{title}</Text>
    </View>
  );
}

// The doctor's queue tabs: Pending / In Progress / Next / Completed / Cancelled.
export function QueueTabs({ active, counts, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabs}>
      {QUEUE_TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={[s.tab, on && s.tabOn]}>
            <Text style={[s.tabText, on && s.tabTextOn]}>{tab.label}</Text>
            <View style={[s.tabCount, on && s.tabCountOn]}>
              <Text translate={false} style={[s.tabCountText, on && s.tabCountTextOn]}>{counts?.[tab.key] ?? 0}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function RecButton({ label, icon, onPress, primary, compact, disabled, full, danger, style }) {
  const fg = primary ? '#FFFFFF' : danger ? '#B42318' : REC.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        compact && s.buttonCompact,
        full && s.buttonFull,
        primary && s.buttonPrimary,
        danger && s.buttonDanger,
        pressed && !disabled && (primary ? s.buttonPrimaryPressed : s.buttonPressed),
        disabled && s.buttonDisabled,
        style,
      ]}
    >
      {!!icon && <Ionicons name={icon} size={compact ? 14 : 16} color={fg} />}
      {!!label && <Text style={[s.buttonText, compact && s.buttonTextCompact, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

// Photos can come back as a server-relative path ("/uploads/..."); like the
// web ProfileAvatar, those load from the server root.
const SERVER_ROOT = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '');
export const resolvePhotoUri = (raw) => {
  const value = toImageUri(raw);
  if (!value) return null;
  if (/^(https?:|data:|file:|content:)/i.test(value)) return value;
  return `${SERVER_ROOT}/${value.replace(/^\/+/, '')}`;
};

export function Avatar({ photo, name, size = 40, rounded = 999, style }) {
  const resolved = resolvePhotoUri(photo);
  const [failed, setFailed] = useState('');
  const uri = resolved && failed !== resolved ? resolved : null;
  const initials = String(name || 'R').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const box = { width: size, height: size, borderRadius: Math.min(rounded, size / 2) };
  if (uri) return <Image source={{ uri }} onError={() => setFailed(uri)} style={[box, s.avatarImage, style]} />;
  return (
    <View style={[box, s.avatarFallback, style]}>
      <Text translate={false} style={[s.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

// A tappable field that opens an OptionSheet — the web portal's <select>.
// `onClear`: shows an × that resets just this filter (only while it is set).
export function SelectField({ label, valueLabel, onPress, disabled, icon, onClear, active }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} disabled={disabled} style={[s.select, disabled && s.selectDisabled, active && s.selectActive]}>
        {!!icon && <Ionicons name={icon} size={16} color={active ? REC.primary : REC.muted} />}
        <Text translate={false} style={[s.selectText, active && s.selectTextActive]} numberOfLines={1}>{valueLabel}</Text>
        {active && onClear ? (
          <Pressable onPress={onClear} hitSlop={10} accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close-circle" size={18} color={REC.muted} />
          </Pressable>
        ) : !disabled && <Ionicons name="chevron-down" size={16} color={REC.muted} />}
      </Pressable>
    </View>
  );
}

export function OptionSheet({ visible, title, options, value, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.sheetOverlay} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: 18 + insets.bottom }]} onPress={() => {}}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{title}</Text>
          <ScrollView style={s.sheetList}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable key={String(option.value)} style={s.sheetOption} onPress={() => { onSelect(option.value); onClose(); }}>
                  <Text translate={false} style={[s.sheetOptionText, active && s.sheetOptionActive]}>{option.label}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={REC.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// One booking as a card — the web's AppointmentTable row on a phone.
export function AppointmentRow({ row: appointment, clinics, onView, onCancel, cancelBusy }) {
  const { withSavedVitals } = useReceptionistVitals();
  const row = withSavedVitals(appointment);
  const busy = cancelBusy && cancelBusy === `${row.source}:${row.id}`;
  const statuses = appointmentStatuses(row);
  // The left edge takes the colour of the visit's state.
  const accent = row.emergency ? '#DC2626' : (BADGES[String(statuses[0] || '').toLowerCase()]?.fg || REC.primary);
  const phone = formatPhoneNumber(row.phoneNumber || row.phone, row.phoneCountryCode || row.patient?.phoneCountryCode);
  const walkIn = row.source === 'walkin';
  return (
    <View style={[s.aptRow, row.emergency && s.aptRowEmergency]}>
      <View style={[s.aptAccent, { backgroundColor: accent }]} />
      <View style={s.aptTop}>
        <View style={[s.tokenTile, row.emergency && s.tokenTileEmergency]}>
          <Text style={s.tokenTileLabel}>{row.emergency ? 'SOS' : 'TOKEN'}</Text>
          <Text translate={false} style={s.tokenTileNumber} numberOfLines={1} adjustsFontSizeToFit>
            {row.token != null && row.token !== '' ? row.token : '--'}
          </Text>
        </View>
        <View style={s.aptIdentity}>
          <Text translate={false} style={s.aptName} numberOfLines={1}>{row.patientName}</Text>
          <View style={s.aptPhoneRow}>
            <Ionicons name="call-outline" size={12} color={REC.muted} />
            <Text translate={false} style={s.aptSub} numberOfLines={1}>{phone || 'Phone not recorded'}</Text>
          </View>
        </View>
        <View style={[s.timePill, row.emergency && s.timePillEmergency]}>
          <Ionicons name={row.emergency ? 'alert-circle' : 'time-outline'} size={13} color={row.emergency ? '#C24848' : REC.primary} />
          <Text translate={false} style={[s.timePillText, row.emergency && s.timePillTextEmergency]}>{row.time ? clockLabel(row.time) : '--'}</Text>
        </View>
      </View>

      <View style={s.aptMeta}>
        <View style={s.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={REC.primary} />
          <Text translate={false} style={s.metaText}>{dateLabel(row.date)}</Text>
        </View>
        <View style={s.metaDivider} />
        <View style={[s.metaItem, s.metaItemGrow]}>
          <Ionicons name="business-outline" size={13} color={REC.primary} />
          <Text translate={false} style={s.metaText} numberOfLines={1}>{clinicName(clinics, row.clinicId)}</Text>
        </View>
      </View>

      <EmergencyReason row={row} />

      <View style={s.aptBadges}>
        {row.emergency && <Badge emergency />}
        {statuses.map((status) => <Badge key={status} value={status} />)}
        <View style={[s.sourceTag, walkIn && s.sourceTagWalkIn]}>
          <Ionicons name={walkIn ? 'walk-outline' : 'globe-outline'} size={11} color={walkIn ? '#B54708' : '#3975C7'} />
          <Text style={[s.sourceTagText, walkIn && s.sourceTagTextWalkIn]}>{walkIn ? 'Walk-in' : 'Online'}</Text>
        </View>
      </View>

      <View style={s.aptActions}>
        {canRecordVitals(row) && (
          <RecButton compact primary label={row.vitals ? 'Edit vitals' : 'Add vitals'} icon={row.vitals ? 'create-outline' : 'add-circle-outline'} onPress={() => onView(row, { editVitals: true })} style={s.flex} />
        )}
        {onCancel && canCancelAppointment(row) && (
          <RecButton compact danger label={busy ? 'Cancelling...' : 'Cancel'} disabled={Boolean(cancelBusy)} onPress={() => onCancel(row)} style={s.flex} />
        )}
        <RecButton compact label="View details" icon="eye-outline" onPress={() => onView(row)} style={s.flex} />
      </View>
    </View>
  );
}

// A value worth showing — not blank and not one of the "nothing here" fillers.
const EMPTY_VALUES = /^(n\/?a|—|-+|not recorded|not provided|not scheduled|not specified|unassigned|none|null|undefined)$/i;
const present = (value) => value != null && String(value).trim() !== '' && !EMPTY_VALUES.test(String(value).trim());

function InfoSection({ icon, title, children }) {
  return (
    <View style={s.infoSection}>
      <View style={s.infoSectionHead}>
        <View style={s.infoSectionIcon}><Ionicons name={icon} size={15} color={REC.primary} /></View>
        <Text style={s.infoSectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// Label / value pairs; rows without a value are left out.
function InfoRows({ rows }) {
  const shown = rows.filter(([, value]) => present(value));
  return shown.map(([label, value], index) => (
    <View key={label} style={[s.infoRow, index === shown.length - 1 && s.infoRowLast]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text translate={false} style={s.infoValue}>{String(value)}</Text>
    </View>
  ));
}

function InfoBlock({ label, value, tone }) {
  if (!present(value)) return null;
  return (
    <View style={[s.infoBlock, tone && s[`infoBlock_${tone}`]]}>
      <Text style={[s.infoBlockLabel, tone && s[`infoBlockLabel_${tone}`]]}>{label}</Text>
      <Text translate={false} style={s.infoBlockValue}>{String(value)}</Text>
    </View>
  );
}

// "View details": the appointment in sections, showing only what was recorded.
function PatientDetailsView({ patient, clinics, doctorName, consultation, medicines, tests }) {
  const phone = formatPhoneNumber(patient.phoneNumber || patient.phone, patient.phoneCountryCode || patient.patient?.phoneCountryCode);
  const clinic = clinicName(clinics, patient.clinicId);
  const startedAt = patient.timing?.startedAt ? displayTime(patient.timing.startedAt) : '';
  const endedAt = patient.timing?.endedAt ? displayTime(patient.timing.endedAt) : '';
  const symptoms = consultation.symptoms || consultation.issue;
  const diagnosis = consultation.diagnosis || consultation.problem;
  const advice = consultation.advice || consultation.instructions;
  const notes = consultation.additionalNotes || consultation.additional_notes || consultation.notes;
  const followUp = consultation.followUpDate || consultation.follow_up_date;
  const hasPatient = [phone, patient.age, patient.gender].some(present);
  const hasCheckup = present(startedAt) || present(endedAt);
  const hasConsultation = [symptoms, diagnosis, advice, notes, followUp].some(present) || medicines.length > 0 || tests.length > 0;

  return (
    <>
      {hasPatient && (
        <InfoSection icon="person-outline" title="Patient">
          <InfoRows rows={[
            ['Phone', phone],
            ['Age', present(patient.age) ? `${patient.age} yrs` : ''],
            ['Gender', patient.gender ? String(patient.gender).replace(/^\w/, (c) => c.toUpperCase()) : ''],
          ]} />
        </InfoSection>
      )}

      <InfoSection icon="calendar-outline" title="Appointment">
        <InfoRows rows={[
          ['Doctor', doctorName],
          ['Clinic / Hospital', clinic],
          ['Date', present(patient.date) ? dateLabel(patient.date) : ''],
          ['Time', patient.time ? clockLabel(patient.time) : ''],
          ['Booked via', patient.source === 'walkin' ? 'Walk-in' : 'Online booking'],
          ['Status', patient.status ? statusLabel(patient.status) : ''],
        ]} />
      </InfoSection>

      {hasCheckup && (
        <InfoSection icon="time-outline" title="Checkup">
          <InfoRows rows={[['Started', startedAt], ['Completed', endedAt]]} />
        </InfoSection>
      )}

      {hasConsultation && (
        <InfoSection icon="medkit-outline" title="Consultation">
          <InfoBlock label="Symptoms" value={symptoms} tone="amber" />
          <InfoBlock label="Diagnosis" value={diagnosis} tone="indigo" />
          {medicines.length > 0 && (
            <View style={s.infoGroup}>
              <Text style={s.infoGroupLabel}>Medicines</Text>
              {medicines.map((medicine, index) => {
                const details = [medicine.dosage, medicine.timings.join(', '), medicine.duration].filter(present);
                return (
                  <View key={`${medicine.name}-${index}`} style={s.medItem}>
                    <View style={s.medItemIndex}><Text translate={false} style={s.medItemIndexText}>{index + 1}</Text></View>
                    <View style={s.flex}>
                      <Text translate={false} style={s.medItemName}>{medicine.name || 'Medicine'}</Text>
                      {details.length > 0 && <Text translate={false} style={s.medItemMeta}>{details.join(' · ')}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {tests.length > 0 && (
            <View style={s.infoGroup}>
              <Text style={s.infoGroupLabel}>Recommended tests</Text>
              <View style={s.testChips}>
                {tests.map((test, index) => (
                  <View key={`${test}-${index}`} style={s.testChip}>
                    <Ionicons name="flask-outline" size={12} color="#3975C7" />
                    <Text translate={false} style={s.testChipText}>{test}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          <InfoBlock label="Advice" value={advice} />
          <InfoBlock label="Additional notes" value={notes} />
          {present(followUp) && (
            <View style={s.followUpRow}>
              <Ionicons name="calendar" size={15} color="#B45309" />
              <Text style={s.followUpLabel}>Follow-up</Text>
              <Text translate={false} style={s.followUpValue}>{dateLabel(followUp)}</Text>
            </View>
          )}
        </InfoSection>
      )}
    </>
  );
}

// The web's PatientDialog as a bottom sheet.
export function PatientDetailsSheet({ patient: appointment, clinics, doctorName, onClose, onCancel, cancelBusy, editVitals = false }) {
  const { withSavedVitals } = useReceptionistVitals();
  const patient = withSavedVitals(appointment);
  const consultation = unpackConsultationNotes(patient) || {};
  const medicines = getDoctorMedicines(consultation);
  const tests = getDoctorTests(consultation);
  const [saving, setSaving] = useState(false);
  const hasVitalsRecorded = VITAL_FIELDS.some(([key]) => hasVital(canonicalVitals(patient?.vitals)[key]));
  const insets = useSafeAreaInsets();
  const {
    scrollRef,
    keyboardOpen,
    keyboardTop,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true, layoutAvoidsKeyboard: true });
  const sheetBottomPadding = keyboardOpen ? 12 : 18 + insets.bottom;
  const requestClose = () => {
    if (saving) return;
    if (keyboardOpen) Keyboard.dismiss();
    else onClose();
  };
  return (
    <Modal visible={Boolean(patient)} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      <View style={[s.sheetOverlay, s.dialogOverlay]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessible={false} />
        <View pointerEvents="box-none" style={[s.dialogFrame, { paddingTop: insets.top + 12 }, keyboardOpen && keyboardTop > 0 && { height: keyboardTop }]}>
        <View style={[s.sheet, s.dialogSheet, keyboardOpen && s.dialogSheetKeyboard, { paddingBottom: sheetBottomPadding }]}>
          {patient && (
            <>
              <View style={s.sheetHandle} />
              <View style={s.cardHeading}>
                <View style={s.flex}>
                  <Eyebrow>{editVitals ? (hasVitalsRecorded ? 'EDIT VITALS' : 'ADD VITALS') : 'PATIENT APPOINTMENT'}</Eyebrow>
                  <Text translate={false} style={s.dialogName}>{patient.patientName || 'Patient'}</Text>
                </View>
                <Pressable onPress={onClose} disabled={saving} style={s.iconButton} hitSlop={8} accessibilityLabel="Close patient details">
                  <Ionicons name="close" size={20} color={REC.ink} />
                </Pressable>
              </View>
              <View style={[s.row, s.wrap]}>
                {appointmentStatuses(patient).map((status) => <Badge key={status} value={status} />)}
                {patient.emergency && <Badge emergency />}
                <Text translate={false} style={s.metaText}>Token {patient.token ?? '--'}</Text>
              </View>
              <ScrollView
                ref={scrollRef}
                style={s.dialogScroll}
                contentContainerStyle={s.dialogScrollContent}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                removeClippedSubviews={false}
                onScroll={handleKeyboardAwareScroll}
                onLayout={handleKeyboardAwareScrollLayout}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator
              >
                {editVitals ? (
                  // Add / Edit vitals: just the form.
                  <PatientVitalsForm key={patientKey(patient)} patient={patient} onInputFocus={scrollFocusedInputIntoView} onSaved={onClose} onBusyChange={setSaving} />
                ) : (
                <>
                <EmergencyReason row={patient} />
                <PatientDetailsView patient={patient} clinics={clinics} doctorName={doctorName} consultation={consultation} medicines={medicines} tests={tests} />
                <PatientVitalsView patient={patient} />
                </>
                )}
              </ScrollView>
              {!editVitals && !!onCancel && canCancelAppointment(patient) && (
                <View style={s.dialogActions}>
                  <RecButton danger label={cancelBusy ? 'Cancelling...' : 'Cancel Appointment'} disabled={saving || Boolean(cancelBusy)} onPress={() => onCancel(patient)} style={s.flex} />
                </View>
              )}
            </>
          )}
        </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { flexWrap: 'wrap', marginTop: 10 },
  card: { borderWidth: 1, borderColor: REC.line, borderRadius: 13, padding: 16, backgroundColor: '#FFFFFF', marginBottom: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  cardTitle: { flexShrink: 1, fontSize: 16.5, fontWeight: '700', color: REC.ink },
  cardSub: { fontSize: 12.5, color: REC.muted, marginTop: 3, lineHeight: 18 },
  count: { fontSize: 11, fontWeight: '600', color: '#728798', backgroundColor: '#F1F5F8', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: REC.primary },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: REC.green },
  dotWarning: { backgroundColor: REC.amber },
  liveLabel: { fontSize: 11, color: '#4A8875' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 4 },
  detailItem: { width: '50%', paddingRight: 10 },
  detailItemFull: { width: '100%', paddingRight: 0 },
  detailTitle: { fontSize: 11, color: REC.muted, marginBottom: 3 },
  detailValue: { fontSize: 13.5, fontWeight: '600', color: REC.ink },
  empty: { paddingVertical: 26, paddingHorizontal: 12, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: REC.ink, marginTop: 8 },
  emptyText: { fontSize: 12.5, color: '#8B9AA9', marginTop: 4, textAlign: 'center' },
  loadingCard: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  loadingText: { fontSize: 13, color: REC.muted, textAlign: 'center' },
  alert: { color: '#A0504B', borderWidth: 1, borderColor: '#F4D7D1', backgroundColor: '#FFF3EE', borderRadius: 9, padding: 13, marginBottom: 14, fontSize: 13 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 13, backgroundColor: '#F6F8FB', borderWidth: 1, borderColor: '#E5EBF0', borderRadius: 9, marginTop: 16 },
  noticeSuccess: { backgroundColor: '#EEF8F2', borderColor: '#D6EEDF' },
  noticeText: { fontSize: 12.5, lineHeight: 19, color: '#6C8396' },
  noticeStrong: { fontWeight: '700', color: REC.ink },
  statGrid: { marginBottom: 14, alignItems: 'stretch' },
  stat: { minWidth: 0, minHeight: 94, borderWidth: 1, borderRadius: 14, padding: 12, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  statFluid: { width: '100%', flex: 1 },
  // Three-up tile: white card, a thin coloured bar on top, centred content.
  statThree: {
    backgroundColor: '#FFFFFF', alignItems: 'center', overflow: 'hidden',
    paddingHorizontal: 8, paddingTop: 16, paddingBottom: 12, minHeight: 0,
    shadowOpacity: 0.06, elevation: 2,
  },
  statThreeAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  statThreeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  statThreeValue: { fontSize: 22, lineHeight: 26, fontWeight: '800', marginTop: 8, fontVariant: ['tabular-nums'] },
  statThreeTitle: { fontSize: 11.5, lineHeight: 15, fontWeight: '600', color: '#5B6B7B', marginTop: 2, textAlign: 'center' },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#475569', marginTop: 8 },
  statValue: { fontSize: 24, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  tabsScroll: { flexGrow: 0, marginTop: 2, marginBottom: 16 },
  tabs: { gap: 8, paddingVertical: 2, paddingRight: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingLeft: 14, paddingRight: 5, borderRadius: 19, borderWidth: 1, borderColor: '#E3E9EE', backgroundColor: '#F4F7F9' },
  tabOn: { backgroundColor: REC.primary, borderColor: REC.primary, shadowColor: REC.primary, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475467' },
  tabTextOn: { color: '#FFFFFF' },
  tabCount: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E9EE' },
  tabCountOn: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'transparent' },
  tabCountText: { fontSize: 12, fontWeight: '800', color: '#344054' },
  tabCountTextOn: { color: '#FFFFFF' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#D8E1E8', backgroundColor: '#FFFFFF', borderRadius: 9, paddingHorizontal: 14, height: 42 },
  buttonCompact: { height: 32, paddingHorizontal: 10, borderRadius: 8 },
  buttonFull: { alignSelf: 'stretch', marginTop: 12 },
  buttonPrimary: { backgroundColor: REC.primary, borderColor: REC.primary },
  buttonPrimaryPressed: { backgroundColor: REC.primaryDark },
  buttonDanger: { borderColor: '#F4C7C3', backgroundColor: '#FFF5F4' },
  buttonPressed: { backgroundColor: '#F2F6F8' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 13.5, fontWeight: '700' },
  buttonTextCompact: { fontSize: 12 },
  avatarImage: { backgroundColor: '#E9F5EF' },
  avatarFallback: { backgroundColor: '#E9F5EF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: REC.primary },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: REC.muted, marginBottom: 6 },
  select: { height: 44, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 9, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  selectDisabled: { backgroundColor: '#F7F9FB' },
  selectActive: { borderColor: '#9BD3C9', backgroundColor: '#F4FAF8' },
  selectTextActive: { fontWeight: '700' },
  selectText: { flex: 1, fontSize: 14, color: REC.ink },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(32,50,72,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 720, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, maxHeight: '80%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: REC.ink, marginBottom: 6 },
  sheetList: { flexGrow: 0 },
  sheetOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  sheetOptionText: { flex: 1, fontSize: 15, color: REC.ink },
  sheetOptionActive: { fontWeight: '700', color: REC.primary },
  aptRow: {
    borderWidth: 1, borderColor: REC.line, borderRadius: 16, padding: 14, paddingLeft: 17, marginBottom: 12, backgroundColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#0F3D38', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  aptRowEmergency: { borderColor: '#F4C9C9', backgroundColor: '#FFFBFB' },
  aptAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  emergencyReason: { marginTop: 10, marginBottom: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#DC2626' },
  emergencyReasonLabel: { fontSize: 11, fontWeight: '700', color: '#B42318', marginBottom: 3 },
  emergencyReasonText: { fontSize: 13, lineHeight: 19, color: REC.ink },
  tokenTile: { width: 54, height: 54, borderRadius: 14, backgroundColor: REC.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tokenTileEmergency: { backgroundColor: '#DC2626' },
  tokenTileNumber: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },
  tokenTileLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.8)' },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, minHeight: 30, borderRadius: 15, backgroundColor: REC.soft },
  timePillEmergency: { backgroundColor: '#FFF0F0' },
  timePillText: { fontSize: 12.5, fontWeight: '800', color: REC.primary },
  timePillTextEmergency: { color: '#C24848' },
  aptTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aptIdentity: { flex: 1, minWidth: 0 },
  patientAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E9F5EF', alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 15, fontWeight: '800', color: REC.primary },
  aptName: { fontSize: 16, fontWeight: '800', color: REC.ink },
  aptPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  aptSub: { flexShrink: 1, fontSize: 12.5, color: REC.muted },
  token: { fontSize: 14, fontWeight: '700', color: '#55748B' },
  aptMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 11, backgroundColor: '#F6F9FA' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaItemGrow: { flex: 1, minWidth: 0 },
  metaDivider: { width: 1, height: 14, backgroundColor: '#DCE3E8' },
  metaText: { flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: '#475467' },
  aptBadges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#E8F1FF' },
  sourceTagWalkIn: { backgroundColor: '#FFF4E5' },
  sourceTagText: { fontSize: 10.5, fontWeight: '700', color: '#3975C7' },
  sourceTagTextWalkIn: { color: '#B54708' },
  aptActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F5' },
  dialogFrame: { height: '100%', maxHeight: '100%', justifyContent: 'flex-end' },
  dialogOverlay: { justifyContent: 'flex-start' },
  dialogSheet: { height: '88%', maxHeight: '100%' },
  dialogSheetKeyboard: { height: '100%' },
  dialogName: { fontSize: 20, fontWeight: '700', color: REC.ink, marginTop: 4 },
  iconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F5F7', alignItems: 'center', justifyContent: 'center' },
  dialogScroll: { flex: 1, minHeight: 0, marginTop: 14 },
  dialogScrollContent: { paddingBottom: 24 },
  // View details sections
  infoSection: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line },
  infoSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  infoSectionIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  infoSectionTitle: { fontSize: 15, fontWeight: '800', color: REC.ink },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F5' },
  infoRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  infoLabel: { fontSize: 13, color: REC.muted },
  infoValue: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', color: REC.ink, textAlign: 'right' },
  infoBlock: { marginTop: 8, padding: 11, borderRadius: 12, backgroundColor: '#F8FAFC', borderLeftWidth: 3, borderLeftColor: '#CBD5E1' },
  infoBlock_amber: { backgroundColor: '#FFF8EC', borderLeftColor: '#F59E0B' },
  infoBlock_indigo: { backgroundColor: '#EEF2FF', borderLeftColor: '#6366F1' },
  infoBlockLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: REC.muted },
  infoBlockLabel_amber: { color: '#B45309' },
  infoBlockLabel_indigo: { color: '#4338CA' },
  infoBlockValue: { fontSize: 13.5, lineHeight: 20, fontWeight: '600', color: REC.ink, marginTop: 3 },
  infoGroup: { marginTop: 12 },
  infoGroupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: REC.muted, marginBottom: 6 },
  medItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#D7EEE8', backgroundColor: '#FBFEFD', marginBottom: 6 },
  medItemIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: REC.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  medItemIndexText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  medItemName: { fontSize: 14, fontWeight: '800', color: REC.ink },
  medItemMeta: { fontSize: 12.5, color: '#475467', marginTop: 2 },
  testChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  testChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#E8F1FF' },
  testChipText: { fontSize: 12.5, fontWeight: '700', color: '#2F5FA3' },
  followUpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  followUpLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400E' },
  followUpValue: { fontSize: 14, fontWeight: '800', color: '#B45309' },
  // Vitals — view
  vitalsCard: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line },
  vitalsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  vitalsIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  vitalsTitle: { fontSize: 15, fontWeight: '800', color: REC.ink },
  vitalsSub: { fontSize: 12, color: REC.muted, marginTop: 1 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  vitalTile: { width: '48.5%', paddingVertical: 11, paddingLeft: 14, paddingRight: 10, borderRadius: 13, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  vitalTileAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  vitalTileLabel: { fontSize: 11.5, fontWeight: '600', color: REC.muted },
  vitalTileValue: { fontSize: 18, fontWeight: '800', color: REC.ink, marginTop: 3 },
  vitalTileUnit: { fontSize: 12, fontWeight: '600', color: REC.muted },
  vitalsEmpty: { fontSize: 13, lineHeight: 19, color: REC.muted, paddingVertical: 6 },
  vitalsNotesBox: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: '#F8FAFC' },
  vitalsNotesLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: REC.muted },
  vitalsNotes: { fontSize: 13, lineHeight: 19, color: '#344054', marginTop: 3 },
  vitalsLocked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: '#F6F8FB', borderWidth: 1, borderColor: '#E5EBF0' },
  vitalsLockedText: { flex: 1, fontSize: 13, lineHeight: 19, color: REC.muted },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
