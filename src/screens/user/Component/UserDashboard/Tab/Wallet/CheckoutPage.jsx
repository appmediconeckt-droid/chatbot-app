import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import PATIENT from '../../../../../../theme/palette';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

const CheckoutPage = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const [selectedPayment, setSelectedPayment] = useState('card');
  const appointment = route?.params?.appointment || {
    counselor: { fullName: 'Dr. Emily Chen', profilePhoto: 'https://ui-avatars.com/api/?name=Emily+Chen' },
    date: '2024-10-04',
    time: '2:30 PM',
    type: 'Video Consultation',
  };

  const consultationFee = 150;
  const gst = consultationFee * 0.18;
  const total = consultationFee + gst;

  const paymentMethods = [
    { id: 'card', icon: 'credit-card', label: 'Card' },
    { id: 'upi', icon: 'phone-in-talk', label: 'UPI' },
    { id: 'wallet', icon: 'account-balance-wallet', label: 'Wallet' },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.backgroundTint} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('Checkout')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Doctor Card */}
        <View style={s.doctorCard}>
          <Image
            source={{ uri: appointment.counselor.profilePhoto }}
            style={s.doctorAvatar}
          />
          <Text style={s.doctorName}>{appointment.counselor.fullName}</Text>
        </View>

        {/* Appointment Details */}
        <View style={s.detailsSection}>
          <Text style={s.sectionTitle}>{t('APPOINTMENT DETAILS')}</Text>

          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <MaterialIcons name="event" size={18} color={PATIENT.primary} />
            </View>
            <View style={s.detailContent}>
              <Text style={s.detailLabel}>{t('Date & Time')}</Text>
              <Text style={s.detailValue}>{appointment.date} {appointment.time}</Text>
            </View>
          </View>

          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <Ionicons name="videocam-outline" size={18} color={PATIENT.primary} />
            </View>
            <View style={s.detailContent}>
              <Text style={s.detailLabel}>{t('Consultation Type')}</Text>
              <Text style={s.detailValue}>{appointment.type}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={s.paymentSection}>
          <Text style={s.sectionTitle}>{t('PAY WITH')}</Text>
          <View style={s.paymentMethods}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[s.paymentOption, selectedPayment === method.id && s.paymentOptionActive]}
                onPress={() => setSelectedPayment(method.id)}
              >
                <MaterialIcons name={method.icon} size={28} color={selectedPayment === method.id ? PATIENT.primary : '#cbd5e1'} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount Display */}
        <TouchableOpacity style={s.amountCard} activeOpacity={0.9}>
          <LinearGradient
            colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.amountGradient}
          >
            <View style={s.amountContent}>
              <Text style={s.amountLabel}>{t('Amount to Pay')}</Text>
              <Text style={s.amountValue}>₹{total.toFixed(2)}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Payment Summary */}
        <View style={s.summarySection}>
          <Text style={s.sectionTitle}>{t('PAYMENT SUMMARY')}</Text>

          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>{t('Consultation Fee')}</Text>
            <Text style={s.summaryValue}>₹{consultationFee.toFixed(2)}</Text>
          </View>

          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>{t('GST (18%)')}</Text>
            <Text style={s.summaryValue}>₹{gst.toFixed(2)}</Text>
          </View>

          <View style={[s.summaryRow, s.summaryRowTotal]}>
            <Text style={s.summaryLabelTotal}>{t('Total')}</Text>
            <Text style={s.summaryValueTotal}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Confirm Payment Button */}
        <TouchableOpacity style={s.confirmButton} activeOpacity={0.85}>
          <LinearGradient
            colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.confirmGradient}
          >
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            <Text style={s.confirmButtonText}>{t('Confirm Payment')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PATIENT.backgroundTint },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  scroll: { flex: 1 },

  doctorCard: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  doctorAvatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 12 },
  doctorName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },

  detailsSection: { backgroundColor: '#ffffff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  detailIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  paymentSection: { marginHorizontal: 16, marginTop: 20 },
  paymentMethods: { flexDirection: 'row', gap: 12, marginTop: 12 },
  paymentOption: { flex: 1, height: 60, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e2e8f0' },
  paymentOptionActive: { borderColor: PATIENT.primary, backgroundColor: '#E6F6EC' },

  amountCard: { marginHorizontal: 16, marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  amountGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  amountContent: { flex: 1 },
  amountLabel: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  amountValue: { fontSize: 20, fontWeight: '800', color: '#ffffff' },

  summarySection: { backgroundColor: '#ffffff', marginHorizontal: 16, marginTop: 20, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  summaryRowTotal: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginBottom: 0 },
  summaryLabelTotal: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  summaryValueTotal: { fontSize: 14, fontWeight: '800', color: PATIENT.primary },

  confirmButton: { marginHorizontal: 16, marginTop: 24, borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  confirmButtonText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
});

export default CheckoutPage;
