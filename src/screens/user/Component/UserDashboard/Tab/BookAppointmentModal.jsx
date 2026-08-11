import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import PATIENT from '../../../../../../theme/palette';
import PatientGradientButton from '../../../../../../components/common/PatientGradientButton';
import useLanguageRender from '../../../../../hooks/useLanguageRender';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BookAppointmentModal = ({ visible, onClose, onConfirm, counselorName = 'Dr. Counselor' }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguageRender();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const handleTimeChange = (event, time) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (time) setSelectedTime(time);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleConfirm = () => {
    if (!clinicalNotes.trim()) {
      Alert.alert('Required', 'Please add clinical notes or reason for your appointment.');
      return;
    }

    onConfirm({
      date: formatDate(selectedDate),
      time: formatTime(selectedTime),
      notes: clinicalNotes,
      counselor: counselorName,
    });

    setClinicalNotes('');
    setSelectedDate(new Date());
    setSelectedTime(new Date());
  };

  const handleCancel = () => {
    setClinicalNotes('');
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{t('Book Appointment with')}</Text>
            <Text style={s.counselorName}>{counselorName}</Text>
            <TouchableOpacity
              style={s.closeButton}
              onPress={handleCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
            {/* Appointment Date & Time Section */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('Appointment Date & Time')}</Text>

              {/* Date Picker */}
              <TouchableOpacity
                style={s.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <View style={s.dateTimeIcon}>
                  <MaterialCommunityIcons name="calendar" size={18} color={PATIENT.primary} />
                </View>
                <View style={s.dateTimeContent}>
                  <Text style={s.dateTimeLabel}>{t('Date')}</Text>
                  <Text style={s.dateTimeValue}>{formatDate(selectedDate)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
              )}

              {/* Time Picker */}
              <TouchableOpacity
                style={[s.dateTimeButton, { marginTop: 12 }]}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.8}
              >
                <View style={s.dateTimeIcon}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={PATIENT.primary} />
                </View>
                <View style={s.dateTimeContent}>
                  <Text style={s.dateTimeLabel}>{t('Time')}</Text>
                  <Text style={s.dateTimeValue}>{formatTime(selectedTime)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                />
              )}
            </View>

            {/* Clinical Notes Section */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('Clinical Notes / Reason')}</Text>
              <TextInput
                style={s.notesInput}
                placeholder={t('Share what you want to discuss in this session')}
                placeholderTextColor="#cbd5e1"
                multiline
                numberOfLines={4}
                value={clinicalNotes}
                onChangeText={setClinicalNotes}
                textAlignVertical="top"
              />
            </View>

            {/* Confirmation Message */}
            <View style={s.confirmSection}>
              <Text style={s.confirmTitle}>{t('Send to the counselor for confirmation')}</Text>
              <Text style={s.confirmSubtitle}>
                Your appointment request will be sent to {counselorName} for confirmation.
              </Text>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Action Buttons */}
          <View style={s.buttonContainer}>
            <TouchableOpacity
              style={[s.button, s.cancelButton]}
              onPress={handleCancel}
              activeOpacity={0.8}
            >
              <Text style={s.cancelButtonText}>{t('Cancel')}</Text>
            </TouchableOpacity>
            <PatientGradientButton
              style={[s.button, s.confirmButton]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={s.confirmButtonText}>{t('Confirm')}</Text>
            </PatientGradientButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    position: 'relative',
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  counselorName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e6ebf1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  dateTimeIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E6F6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTimeContent: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 3,
  },
  dateTimeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e6ebf1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '500',
    color: '#0f172a',
    minHeight: 100,
  },
  confirmSection: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  confirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3b82f6',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e6ebf1',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  confirmButton: {
    overflow: 'hidden',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default BookAppointmentModal;
