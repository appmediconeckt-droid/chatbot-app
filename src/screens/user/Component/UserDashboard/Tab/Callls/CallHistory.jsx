import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SectionList,
  StyleSheet,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Modal Components (simplified versions)
const VideoCallModal = ({ isOpen, onClose, callData }) => {
  const [callActive, setCallActive] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const endCall = () => {
    setCallActive(false);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.videoCallUI}>
        <View style={styles.videoMain}>
          <View style={styles.remoteVideo}>
            <View style={styles.videoPlaceholder}>
              <Text style={styles.remoteAvatar}>
                {callData?.profilePic || '👨‍⚕️'}
              </Text>
              <Text style={styles.videoPlaceholderName}>
                {callData?.name || 'Dr. John Doe'}
              </Text>
              <Text style={styles.callStatus}>
                {callActive ? 'Call in progress...' : 'Call ended'}
              </Text>
            </View>
          </View>
          <View style={styles.localVideo}>
            <View style={styles.localVideoPlaceholder}>
              <Text style={{ fontSize: 24 }}>👤</Text>
            </View>
          </View>
        </View>

        <View style={styles.callControls}>
          {callActive && (
            <Text style={styles.callTimer}>
              {formatDuration(callDuration)}
            </Text>
          )}
          <View style={styles.controlButtons}>
            <TouchableOpacity style={styles.controlBtn} onPress={() => {}}>
              <Text style={styles.controlBtnText}>🎤</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={() => {}}>
              <Text style={styles.controlBtnText}>📹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlBtn, styles.endCall]} onPress={endCall}>
              <Text style={styles.controlBtnText}>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const VoiceCallModal = ({ isOpen, onClose, callData }) => {
  const [callActive, setCallActive] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);

  useEffect(() => {
    let interval;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const endCall = () => {
    setCallActive(false);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.voiceCallUI}>
        <View style={styles.callerInfo}>
          <View style={styles.callerAvatarLarge}>
            <Text style={{ fontSize: 80 }}>
              {callData?.profilePic || '👨‍⚕️'}
            </Text>
          </View>
          <Text style={styles.callerName}>{callData?.name || 'Dr. John Doe'}</Text>
          <Text style={styles.callStatusText}>
            {callActive ? 'Call in progress...' : 'Call ended'}
          </Text>
        </View>

        {callActive && (
          <Text style={styles.callTimerLarge}>
            {formatDuration(callDuration)}
          </Text>
        )}

        <View style={styles.callActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, micMuted && styles.actionBtnActive]} 
            onPress={() => setMicMuted(!micMuted)}
          >
            <Text style={styles.actionBtnText}>{micMuted ? '🎤❌' : '🎤'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, speakerOn && styles.actionBtnActive]} 
            onPress={() => setSpeakerOn(!speakerOn)}
          >
            <Text style={styles.actionBtnText}>{speakerOn ? '🔊' : '🔈'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.endCallBtn]} onPress={endCall}>
            <Text style={styles.actionBtnText}>📞</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const CallHistory = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  // Call Data
  const callsData = [
    {
      id: 1,
      name: "Dr. Priya Sharma",
      type: "video",
      status: "outgoing",
      date: "Today",
      time: "10:30 AM",
      duration: "25:30",
      profilePic: "👩‍⚕️",
      phoneNumber: "+91 98765 43210",
      missed: false
    },
    {
      id: 2,
      name: "Dr. Rajesh Kumar",
      type: "voice",
      status: "incoming",
      date: "Today",
      time: "09:15 AM",
      duration: "15:20",
      profilePic: "👨‍⚕️",
      phoneNumber: "+91 98765 43211",
      missed: false
    },
    {
      id: 3,
      name: "Dr. Sneha Patel",
      type: "video",
      status: "missed",
      date: "Yesterday",
      time: "06:45 PM",
      duration: null,
      profilePic: "👩‍⚕️",
      phoneNumber: "+91 98765 43212",
      missed: true
    },
    {
      id: 4,
      name: "Dr. Amit Verma",
      type: "voice",
      status: "outgoing",
      date: "Yesterday",
      time: "03:20 PM",
      duration: "12:15",
      profilePic: "👨‍⚕️",
      phoneNumber: "+91 98765 43213",
      missed: false
    },
    {
      id: 5,
      name: "Dr. Neha Gupta",
      type: "video",
      status: "incoming",
      date: "19 Feb",
      time: "11:00 AM",
      duration: "32:10",
      profilePic: "👩‍⚕️",
      phoneNumber: "+91 98765 43214",
      missed: false
    }
  ];

  // Filter calls
  const filteredCalls = callsData.filter(call => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'missed') return call.missed;
    if (activeFilter === 'video') return call.type === 'video';
    if (activeFilter === 'voice') return call.type === 'voice';
    return true;
  }).filter(call => 
    call.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group calls by date for SectionList
  const groupedCalls = () => {
    const groups = {};
    filteredCalls.forEach(call => {
      const date = call.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(call);
    });
    return Object.keys(groups).map(date => ({
      title: date,
      data: groups[date]
    }));
  };

  // Open appropriate modal based on call type
  const openCallModal = (call) => {
    setSelectedCall(call);
    if (call.type === 'video') {
      setIsVideoModalOpen(true);
    } else {
      setIsVoiceModalOpen(true);
    }
  };

  // Open video call modal with default data
  const openNewVideoCall = () => {
    setSelectedCall(null);
    setIsVideoModalOpen(true);
  };

  // Open voice call modal with default data
  const openNewVoiceCall = () => {
    setSelectedCall(null);
    setIsVoiceModalOpen(true);
  };

  // Get icon for call type
  const getCallIcon = (type, status) => {
    if (type === 'video') return '📹';
    return '📞';
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch(status) {
      case 'incoming': return '⬇️';
      case 'outgoing': return '⬆️';
      case 'missed': return '❌';
      default: return '⬆️';
    }
  };

  const renderCallItem = ({ item: call }) => (
    <TouchableOpacity 
      style={[styles.callItem, call.missed && styles.missedCall]}
      onPress={() => openCallModal(call)}
      activeOpacity={0.7}
    >
      {/* Profile Picture */}
      <View style={styles.callAvatar}>
        <Text style={styles.callAvatarEmoji}>{call.profilePic}</Text>
      </View>

      {/* Call Info */}
      <View style={styles.callInfo}>
        <View style={styles.callNameRow}>
          <Text style={styles.callName} numberOfLines={1}>
            {call.name}
          </Text>
          <Text style={styles.callTime}>{call.time}</Text>
        </View>
        
        <View style={styles.callDetails}>
          <Text style={styles.callStatusIcon}>{getStatusIcon(call.status)}</Text>
          <Text style={styles.callTypeIcon}>{getCallIcon(call.type, call.status)}</Text>
          <Text style={styles.callType}>
            {call.type === 'video' ? 'Video Call' : 'Voice Call'}
          </Text>
          {call.duration && (
            <>
              <Text style={styles.callDot}>•</Text>
              <Text style={styles.callDuration}>{call.duration}</Text>
            </>
          )}
          {call.missed && (
            <View style={styles.callMissedTag}>
              <Text style={styles.callMissedTagText}>Missed</Text>
            </View>
          )}
        </View>
      </View>

      {/* Call Action Button */}
      <TouchableOpacity 
        style={styles.callActionBtn}
        onPress={() => openCallModal(call)}
      >
        <Text style={styles.callActionBtnText}>
          {call.type === 'video' ? '📹' : '📞'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.callDateHeader}>
      <Text style={styles.callDate}>{title}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.callNoResults}>
      <Text style={styles.callNoResultsIcon}>📞</Text>
      <Text style={styles.callNoResultsTitle}>No calls found</Text>
      <Text style={styles.callNoResultsSubtitle}>
        Try changing your search or filter
      </Text>
    </View>
  );

  const filterButtons = [
    { key: 'all', label: 'All' },
    { key: 'missed', label: 'Missed' },
    { key: 'video', label: 'Video' },
    { key: 'voice', label: 'Voice' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      {/* Fixed Header Section */}
      <View style={styles.headerFixed}>
        {/* Header */}
        <View style={styles.callHeader}>
          <Text style={styles.callTitle}>Call History</Text>
          <View style={styles.callHeaderActions}>
            <TouchableOpacity 
              style={styles.callIconBtn} 
              onPress={openNewVoiceCall}
            >
              <Text style={styles.callIconBtnText}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.callIconBtn} 
              onPress={openNewVideoCall}
            >
              <Text style={styles.callIconBtnText}>📹</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.callSearch}>
          <Text style={styles.callSearchIcon}>🔍</Text>
          <TextInput
            style={styles.callSearchInput}
            placeholder="Search calls..."
            placeholderTextColor="#8696a0"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm !== '' && (
            <TouchableOpacity style={styles.callClearBtn} onPress={() => setSearchTerm('')}>
              <Text style={styles.callClearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.callFilters}>
          {filterButtons.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.callFilterBtn,
                activeFilter === filter.key && styles.callFilterBtnActive
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text style={[
                styles.callFilterBtnText,
                activeFilter === filter.key && styles.callFilterBtnTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Scrollable Calls List */}
      <SectionList
        sections={groupedCalls()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCallItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.callsList}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />

      {/* Modals */}
      <VideoCallModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        callData={selectedCall}
      />

      <VoiceCallModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        callData={selectedCall}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  // Fixed Header Section
  headerFixed: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  // Header
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  callTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  callHeaderActions: {
    flexDirection: 'row',
    gap: 20,
  },
  callIconBtn: {
    padding: 5,
  },
  callIconBtnText: {
    fontSize: 22,
  },
  // Search Bar
  callSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f2f5',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  callSearchIcon: {
    fontSize: 18,
    color: '#6b7c85',
    marginRight: 10,
  },
  callSearchInput: {
    flex: 1,
    fontSize: 15,
    padding: 5,
    color: '#111b21',
  },
  callClearBtn: {
    paddingHorizontal: 8,
  },
  callClearBtnText: {
    fontSize: 18,
    color: '#8696a0',
  },
  // Filter Tabs
  callFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  callFilterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: '#f0f2f5',
  },
  callFilterBtnActive: {
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  callFilterBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b4a54',
  },
  callFilterBtnTextActive: {
    color: 'white',
  },
  // Calls List
  callsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  // Date Group
  callDateHeader: {
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  callDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667781',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Call Item
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  missedCall: {
    // Style for missed calls
  },
  // Avatar
  callAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  callAvatarEmoji: {
    fontSize: 26,
  },
  // Call Info
  callInfo: {
    flex: 1,
  },
  callNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  callName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111b21',
    flex: 1,
    marginRight: 10,
  },
  callTime: {
    fontSize: 12,
    color: '#667781',
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  callStatusIcon: {
    fontSize: 12,
  },
  callTypeIcon: {
    fontSize: 12,
  },
  callType: {
    fontSize: 13,
    color: '#667781',
  },
  callDot: {
    color: '#8696a0',
    fontWeight: 'bold',
  },
  callDuration: {
    fontSize: 13,
    color: '#667781',
  },
  callMissedTag: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 30,
    marginLeft: 4,
  },
  callMissedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d32f2f',
  },
  // Call Action Button
  callActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  callActionBtnText: {
    fontSize: 20,
  },
  // No Results
  callNoResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  callNoResultsIcon: {
    fontSize: 58,
    marginBottom: 15,
    opacity: 0.5,
  },
  callNoResultsTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3b4a54',
    marginBottom: 5,
  },
  callNoResultsSubtitle: {
    fontSize: 14,
    color: '#8696a0',
  },
  // Video Call UI
  videoCallUI: {
    flex: 1,
    backgroundColor: '#0b0e14',
  },
  videoMain: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a3f5e',
  },
  remoteAvatar: {
    fontSize: 120,
    marginBottom: 20,
  },
  videoPlaceholderName: {
    fontSize: 28,
    fontWeight: '600',
    color: 'white',
    marginBottom: 10,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  localVideo: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: '#2a3f5e',
  },
  localVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Voice Call UI
  voiceCallUI: {
    flex: 1,
    backgroundColor: '#1e3c5f',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 50,
  },
  callerInfo: {
    alignItems: 'center',
  },
  callerAvatarLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  callerName: {
    fontSize: 32,
    fontWeight: '600',
    color: 'white',
    marginBottom: 10,
  },
  callStatusText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
  },
  callTimerLarge: {
    fontSize: 28,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginVertical: 20,
  },
  // Call Controls
  callControls: {
    padding: 30,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  callTimer: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    color: 'white',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnText: {
    fontSize: 24,
  },
  endCall: {
    backgroundColor: '#ef4444',
  },
  // Call Actions
  callActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#3b82f6',
  },
  actionBtnText: {
    fontSize: 24,
  },
  endCallBtn: {
    backgroundColor: '#ef4444',
  },
});

// Helper to add animation pulse effect (you'll need to use Animated API for actual animations)
const pulseAnimation = {
  // Implement with Animated API if needed
};

export default CallHistory;