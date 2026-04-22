import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const PatientRequests = () => {
  // Sample patient requests data
  const [patients, setPatients] = useState([
    {
      id: 'PT001',
      name: 'Rahul Sharma',
      age: 28,
      gender: 'Male',
      issue: 'Anxiety and Stress',
      requestedDate: '2024-01-15',
      status: 'pending',
      priority: 'high',
      contact: '+91 98765 43210'
    },
    {
      id: 'PT002',
      name: 'Priya Patel',
      age: 32,
      gender: 'Female',
      issue: 'Depression',
      requestedDate: '2024-01-14',
      status: 'pending',
      priority: 'medium',
      contact: '+91 98765 43211'
    },
    {
      id: 'PT003',
      name: 'Amit Kumar',
      age: 45,
      gender: 'Male',
      issue: 'Work-life balance',
      requestedDate: '2024-01-14',
      status: 'pending',
      priority: 'low',
      contact: '+91 98765 43212'
    },
    {
      id: 'PT004',
      name: 'Neha Singh',
      age: 24,
      gender: 'Female',
      issue: 'Relationship counseling',
      requestedDate: '2024-01-13',
      status: 'pending',
      priority: 'high',
      contact: '+91 98765 43213'
    }
  ]);

  const [filter, setFilter] = useState('all');

  // Handle accept request
  const handleAccept = (patientId) => {
    setPatients(prevPatients =>
      prevPatients.map(patient =>
        patient.id === patientId
          ? { ...patient, status: 'accepted' }
          : patient
      )
    );
    Alert.alert('Success', `Patient ${patientId} has been accepted successfully!`);
  };

  // Handle cancel request
  const handleCancel = (patientId) => {
    setPatients(prevPatients =>
      prevPatients.map(patient =>
        patient.id === patientId
          ? { ...patient, status: 'cancelled' }
          : patient
      )
    );
    Alert.alert('Cancelled', `Patient ${patientId} has been cancelled.`);
  };

  // Filter patients based on status
  const filteredPatients = patients.filter(patient => {
    if (filter === 'all') return true;
    return patient.status === filter;
  });

  // Get status style
  const getStatusStyle = (status) => {
    switch(status) {
      case 'pending': return styles.statusPending;
      case 'accepted': return styles.statusAccepted;
      case 'cancelled': return styles.statusCancelled;
      default: return {};
    }
  };

  const getStatusTextStyle = (status) => {
    switch(status) {
      case 'pending': return styles.statusPendingText;
      case 'accepted': return styles.statusAcceptedText;
      case 'cancelled': return styles.statusCancelledText;
      default: return {};
    }
  };

  // Get priority style
  const getPriorityStyle = (priority) => {
    switch(priority) {
      case 'high': return styles.priorityHigh;
      case 'medium': return styles.priorityMedium;
      case 'low': return styles.priorityLow;
      default: return {};
    }
  };

  const getPriorityTextStyle = (priority) => {
    switch(priority) {
      case 'high': return styles.priorityHighText;
      case 'medium': return styles.priorityMediumText;
      case 'low': return styles.priorityLowText;
      default: return {};
    }
  };

  // Get card border style based on patient ID
  const getCardBorderStyle = (patientId) => {
    switch(patientId) {
      case 'PT001': return styles.cardPt001;
      case 'PT002': return styles.cardPt002;
      case 'PT003': return styles.cardPt003;
      case 'PT004': return styles.cardPt004;
      default: return {};
    }
  };

  // Get name color style based on patient ID
  const getNameColorStyle = (patientId) => {
    switch(patientId) {
      case 'PT001': return styles.namePt001;
      case 'PT002': return styles.namePt002;
      case 'PT003': return styles.namePt003;
      case 'PT004': return styles.namePt004;
      default: return {};
    }
  };

  const pendingCount = patients.filter(p => p.status === 'pending').length;
  const acceptedCount = patients.filter(p => p.status === 'accepted').length;
  const cancelledCount = patients.filter(p => p.status === 'cancelled').length;

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>Patient Requests Dashboard</Text>
        
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, styles.statPending]}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{pendingCount}</Text>
          </View>
          <View style={[styles.statBox, styles.statAccepted]}>
            <Text style={styles.statLabel}>Accepted</Text>
            <Text style={styles.statValue}>{acceptedCount}</Text>
          </View>
          <View style={[styles.statBox, styles.statCancelled]}>
            <Text style={styles.statLabel}>Cancelled</Text>
            <Text style={styles.statValue}>{cancelledCount}</Text>
          </View>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Filter by status:</Text>
        <View style={styles.filterSelectWrapper}>
          <TouchableOpacity 
            style={[styles.filterOption, filter === 'all' && styles.filterOptionActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterOptionText, filter === 'all' && styles.filterOptionTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterOption, filter === 'pending' && styles.filterOptionActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterOptionText, filter === 'pending' && styles.filterOptionTextActive]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterOption, filter === 'accepted' && styles.filterOptionActive]}
            onPress={() => setFilter('accepted')}
          >
            <Text style={[styles.filterOptionText, filter === 'accepted' && styles.filterOptionTextActive]}>Accepted</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterOption, filter === 'cancelled' && styles.filterOptionActive]}
            onPress={() => setFilter('cancelled')}
          >
            <Text style={[styles.filterOptionText, filter === 'cancelled' && styles.filterOptionTextActive]}>Cancelled</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Patients Grid */}
      <View style={styles.patientsGrid}>
        {filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => (
            <View 
              key={patient.id} 
              style={[styles.patientCard, getCardBorderStyle(patient.id)]}
            >
              {/* Patient Header */}
              <View style={styles.patientHeader}>
                <View style={styles.patientIdSection}>
                  <Text style={styles.patientIdLabel}>Patient Code:</Text>
                  <View style={styles.patientIdValueWrapper}>
                    <Text style={styles.patientIdValue}>{patient.id}</Text>
                  </View>
                </View>
                <View style={[styles.priorityBadge, getPriorityStyle(patient.priority)]}>
                  <Text style={[styles.priorityText, getPriorityTextStyle(patient.priority)]}>
                    {patient.priority} priority
                  </Text>
                </View>
              </View>

              {/* Patient Details */}
              <View style={styles.patientDetails}>
                <Text style={[styles.patientName, getNameColorStyle(patient.id)]}>
                  {patient.name}
                </Text>
                
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Age/Gender:</Text>
                    <Text style={styles.infoValue}>{patient.age} yrs, {patient.gender}</Text>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Issue:</Text>
                    <Text style={styles.infoValue}>{patient.issue}</Text>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Requested:</Text>
                    <Text style={styles.infoValue}>{patient.requestedDate}</Text>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Contact:</Text>
                    <Text style={styles.infoValue}>{patient.contact}</Text>
                  </View>
                </View>

                {/* Status Badge */}
                <View style={[styles.statusBadge, getStatusStyle(patient.status)]}>
                  <Text style={[styles.statusText, getStatusTextStyle(patient.status)]}>
                    {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons - Show only for pending requests */}
              {patient.status === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.btnAccept}
                    onPress={() => handleAccept(patient.id)}
                  >
                    <Text style={styles.btnAcceptText}>✓ Accept Request</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.btnCancel}
                    onPress={() => handleCancel(patient.id)}
                  >
                    <Text style={styles.btnCancelText}>✕ Cancel Request</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.noPatients}>
            <Text style={styles.noPatientsText}>No patients found with the selected filter.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  // Header Styles
  header: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  statPending: {
    backgroundColor: '#f39c12',
  },
  statAccepted: {
    backgroundColor: '#27ae60',
  },
  statCancelled: {
    backgroundColor: '#e74c3c',
  },
  statLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  // Filter Section
  filterSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 12,
  },
  filterSelectWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterOptionActive: {
    backgroundColor: '#667eea',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  filterOptionTextActive: {
    color: 'white',
  },
  // Patients Grid
  patientsGrid: {
    gap: 16,
  },
  // Patient Card
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 5,
  },
  cardPt001: { borderLeftColor: '#ff6b6b' },
  cardPt002: { borderLeftColor: '#4ecdc4' },
  cardPt003: { borderLeftColor: '#45b7d1' },
  cardPt004: { borderLeftColor: '#96ceb4' },
  // Patient Header
  patientHeader: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  patientIdSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  patientIdLabel: {
    fontSize: 12,
    color: '#777',
  },
  patientIdValueWrapper: {
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  patientIdValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  // Priority Badge
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  priorityHigh: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  priorityMedium: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  priorityLow: {
    backgroundColor: '#e8f5e8',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priorityHighText: { color: '#c62828' },
  priorityMediumText: { color: '#ef6c00' },
  priorityLowText: { color: '#2e7d32' },
  // Patient Details
  patientDetails: {
    padding: 16,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  namePt001: { color: '#ff6b6b' },
  namePt002: { color: '#4ecdc4' },
  namePt003: { color: '#45b7d1' },
  namePt004: { color: '#96ceb4' },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  infoItem: {
    width: '50%',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 11,
    color: '#777',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  // Status Badge
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPending: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  statusAccepted: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  statusCancelled: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusPendingText: { color: '#ef6c00' },
  statusAcceptedText: { color: '#2e7d32' },
  statusCancelledText: { color: '#c62828' },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  btnAccept: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAcceptText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCancelText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // No Patients
  noPatients: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 15,
  },
  noPatientsText: {
    fontSize: 14,
    color: '#777',
  },
});

export default PatientRequests;