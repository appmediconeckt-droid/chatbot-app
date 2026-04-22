import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  Animated,
  SafeAreaView,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { API_BASE_URL } from "../../../../../axiosConfig";
import Icon from "react-native-vector-icons/FontAwesome5";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from 'react-native-linear-gradient';
import safeVibrate from "../../../../../utils/safeVibrate";
import ChatInterface from "../Tab/chatbot/ChatInterface";
import CounselorTable from "../Tab/Counselor/CounselorDirectory";
import WalletDashboard from "../Tab/Wallet/WalletDashboard";
import CallHistory from "../Tab/Callls/CallHistory";
import PatientProfile from "../../PatientProfile/PatientProfile";

const { width, height } = Dimensions.get("window");

// ChatPopup Component
const ChatPopup = ({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  isLoading,
  onClose,
}) => (
  <Modal animationType="slide" transparent={true} visible={true}>
    <View style={styles.chatPopupOverlay}>
      <View style={styles.chatPopup}>
        <View style={styles.chatPopupHeader}>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatAvatar}>
              <MaterialIcons name="smart-toy" size={20} color="white" />
            </View>
            <View>
              <Text style={styles.chatHeaderTitle}>M-Chatbot AI Assistant</Text>
              <Text style={styles.chatStatus}>Online • 24/7 Support</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.chatCloseBtn}>
            <Text style={styles.chatCloseText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.chatPopupBody}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.chatMessageWrapper,
                message.sender === "user" && styles.chatMessageWrapperUser,
              ]}
            >
              {message.sender === "ai" && (
                <View style={[styles.chatAvatar, styles.chatAvatarSmall]}>
                  <MaterialIcons name="smart-toy" size={14} color="white" />
                </View>
              )}
              <View
                style={[
                  styles.chatBubble,
                  message.sender === "user" && styles.chatBubbleUser,
                ]}
              >
                <Text
                  style={[
                    styles.chatBubbleText,
                    message.sender === "user" && styles.chatBubbleTextUser,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
              {message.sender === "user" && (
                <View style={[styles.chatAvatar, styles.chatAvatarSmall]}>
                  <Ionicons name="person-circle" size={14} color="#667eea" />
                </View>
              )}
            </View>
          ))}
          {isLoading && (
            <View style={[styles.chatMessageWrapper, styles.chatMessageWrapperAi]}>
              <View style={[styles.chatAvatar, styles.chatAvatarSmall]}>
                <MaterialIcons name="smart-toy" size={14} color="white" />
              </View>
              <View style={styles.chatBubble}>
                <View style={styles.loadingDots}>
                  <View style={styles.loadingDot} />
                  <View style={styles.loadingDot} />
                  <View style={styles.loadingDot} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.chatPopupFooter}>
          <TextInput
            style={styles.chatInput}
            placeholder="Type your message..."
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || isLoading}
          >
            <MaterialIcons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ChatButton Component
const ChatButton = ({ onClick, unreadCount }) => (
  <TouchableOpacity style={styles.floatingChatBtn} onPress={onClick}>
    <Text style={styles.floatingChatBtnText}>AI</Text>
    {unreadCount > 0 && (
      <View style={styles.unreadBadge}>
        <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// Call Modal Component
const CallModal = ({
  isOpen,
  onClose,
  callType,
  callerName,
  callerImage,
  callData,
  onAcceptCall,
  onRejectCall,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isOpen, pulseAnim]);

  const handleAccept = async () => {
    if (isAccepting) return;
    setIsAccepting(true);
    if (onAcceptCall && callData) {
      await onAcceptCall(callData.callId);
      onClose();
    }
    setIsAccepting(false);
  };

  const handleReject = async () => {
    if (isRejecting) return;
    setIsRejecting(true);
    if (onRejectCall && callData) {
      await onRejectCall(callData.callId);
      onClose();
    }
    setIsRejecting(false);
  };

  if (!isOpen) return null;

  const displayName = callData?.from?.fullName || callerName || "Counselor";
  const profilePhoto = callData?.from?.profilePhoto || callerImage;

  return (
    <Modal transparent={true} visible={isOpen} animationType="fade">
      <View style={styles.callModalOverlay}>
        <View style={styles.callModal}>
          <View style={styles.callModalContent}>
            <View style={styles.callerInfo}>
              <Animated.View style={[styles.callerAvatar, { transform: [{ scale: pulseAnim }] }]}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.callerAvatarImage} />
                ) : (
                  <MaterialIcons name="person" size={44} color="white" />
                )}
              </Animated.View>
              <Text style={styles.callerName}>{displayName}</Text>
              <Text style={styles.callType}>
                {callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
              </Text>
            </View>

            <View style={styles.callControls}>
              <TouchableOpacity
                style={[styles.callBtn, styles.rejectBtn]}
                onPress={handleReject}
                disabled={isRejecting}
              >
                <MaterialIcons name="call-end" size={22} color="white" />
                <Text style={styles.callBtnText}>
                  {isRejecting ? "Rejecting..." : "Decline"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callBtn, styles.acceptBtn]}
                onPress={handleAccept}
                disabled={isAccepting}
              >
                <MaterialIcons name="call" size={22} color="white" />
                <Text style={styles.callBtnText}>
                  {isAccepting ? "Accepting..." : "Accept"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Video Call Modal Component - FIXED
const VideoCallModal = ({ isOpen, onClose, callData, onEndCall }) => (
  <Modal transparent={true} visible={isOpen} animationType="slide">
    <View style={styles.videoCallModalOverlay}>
      <View style={styles.videoCallModal}>
        <View style={styles.videoBackground}>
          <View style={styles.remoteVideoPlaceholder}>
            {callData?.from?.profilePhoto ? (
              <Image source={{ uri: callData.from.profilePhoto }} style={styles.remoteAvatar} />
            ) : (
              <MaterialIcons name="person" size={80} color="#667eea" />
            )}
            <Text style={styles.remoteName}>{callData?.from?.fullName || "Counselor"}</Text>
            <View style={styles.videoLoading}>
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={styles.videoLoadingText}>Connecting...</Text>
            </View>
          </View>
          <View style={styles.localVideoPreview}>
            <View style={styles.localVideoPlaceholder}>
              <MaterialIcons name="videocam" size={24} color="#667eea" />
              <Text style={styles.localVideoText}>You</Text>
            </View>
          </View>
        </View>
        <View style={styles.videoCallControls}>
          <TouchableOpacity style={[styles.videoCallBtn, styles.endCallBtn]} onPress={onClose}>
            <MaterialIcons name="call-end" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Voice Call Modal Component - FIXED (no duplicate Modal tags)
const VoiceCallModal = ({ isOpen, onClose, callData, onEndCall }) => (
  <Modal transparent={true} visible={isOpen} animationType="slide">
    <View style={styles.voiceCallModalOverlay}>
      <View style={styles.voiceCallModal}>
        <View style={styles.voiceCallContent}>
          <View style={styles.voiceCallerAvatar}>
            {callData?.from?.profilePhoto ? (
              <Image source={{ uri: callData.from.profilePhoto }} style={styles.voiceAvatar} />
            ) : (
              <MaterialIcons name="person" size={60} color="#667eea" />
            )}
          </View>
          <Text style={styles.voiceCallerName}>{callData?.from?.fullName || "Counselor"}</Text>
          <Text style={styles.voiceCallStatus}>Connecting...</Text>
          <TouchableOpacity style={[styles.voiceCallBtn, styles.endCallBtn]} onPress={onClose}>
            <MaterialIcons name="call-end" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export default function UserDashboard() {
  const navigation = useNavigation();
  const [active, setActive] = useState("Home");
  const [chatOpen, setChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Call Modal States
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType, setCallType] = useState("video");
  const [callerInfo, setCallerInfo] = useState({
    name: "",
    image: null,
    userId: "",
    userName: "",
    callId: "",
    roomId: "",
    waitingDuration: 0,
  });
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  const [userId, setUserId] = useState(null);
  const chatBodyRef = useRef(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phone: "",
    profilePhoto: "",
  });

  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI assistant. How can I help you today?",
      sender: "ai",
    },
  ]);

  useEffect(() => {
    checkMobile();
    fetchUserData();
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
    }
  }, [chatOpen]);

  const checkMobile = () => {
    setIsMobile(width <= 768);
  };

  const fetchUserData = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem("userId");
      const token = await AsyncStorage.getItem("token");

      if (!storedUserId) return;

      const response = await axios.get(`${API_BASE_URL}/api/auth/getUser/${storedUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const user = response.data.user;
        setUserData({
          name: user.fullName || "",
          email: user.email || "",
          phone: user.phoneNumber || "",
          profilePhoto: user.profilePhoto?.url || "",
        });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: newMessage,
      sender: "user",
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setIsLoading(true);

    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");

      // Fix 401 error by including proper authentication
      const response = await axios.post(
        `${API_BASE_URL}/api/chat/send`,
        {
          userId: userId,
          message: newMessage,
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        }
      );

      if (response.data && response.data.reply) {
        const aiMessage = {
          id: Date.now() + 1,
          text: response.data.reply,
          sender: "ai",
        };
        setChatMessages((prev) => [...prev, aiMessage]);
      } else {
        // Fallback response if API fails
        const fallbackMessage = {
          id: Date.now() + 1,
          text: "I'm here to help. Could you please rephrase that?",
          sender: "ai",
        };
        setChatMessages((prev) => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error("Chat API error:", error);
      
      // Handle 401 error specifically
      if (error.response && error.response.status === 401) {
        console.log("Authentication failed - token may be expired");
        // Optional: Redirect to login or refresh token
      }
      
      // Fallback local response for demo
      const aiResponses = [
        "I understand. Would you like to try some breathing exercises?",
        "Thank you for sharing. How long have you been feeling this way?",
        "I'm here to listen. Would you like me to suggest some coping strategies?",
        "Would you like me to connect you with a mental health professional?",
      ];
      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponses[Math.floor(Math.random() * aiResponses.length)],
        sender: "ai",
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
      if (!chatOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    }
  };

  const handleMenuItemClick = (id) => {
    safeVibrate(30);
    setActive(id);
    if (isMobile) {
      setShowMoreModal(false);
      setShowProfileMenu(false);
    }
  };

  const handleProfileClick = () => {
    safeVibrate(30);
    setActive("profile");
    if (isMobile) {
      setShowProfileMenu(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      navigation.navigate("RoleSelector");
    } catch (error) {
      console.error("Logout error:", error);
      navigation.navigate("RoleSelector");
    }
  };

  const handleDeleteConfirm = () => {
    safeVibrate([100, 50, 100]);
    setShowDeleteConfirm(false);
    setDeleteSuccess(true);
    setTimeout(() => {
      navigation.navigate("RoleSelector");
    }, 2500);
  };

  const handleAcceptCall = async (callId) => {
    setSelectedCall(callerInfo);
    if (callType !== "video") {
      setIsVoiceModalOpen(true);
    } else {
      setIsVideoModalOpen(true);
    }
    setShowCallModal(false);
  };

  const handleRejectCall = async (callId) => {
    setShowCallModal(false);
  };

  const allMenuItems = [
    { id: "Chat", icon: "comment", label: "Chat", type: "fontawesome5" },
    { id: "Counselor", icon: "user-md", label: "Counselor", type: "fontawesome5" },
    { id: "Wallet", icon: "wallet", label: "Wallet", type: "fontawesome5" },
    { id: "Video", icon: "video", label: "Call History", type: "fontawesome5" },
    { id: "help", icon: "question-circle", label: "Help & Support", type: "fontawesome5" },
    { id: "privacy", icon: "lock", label: "Privacy", type: "fontawesome5" },
  ];

  const bottomMenuItems = allMenuItems.slice(0, 4);

  const renderIcon = (item, color = "#667eea") => {
    const size = 18;
    return <Icon name={item.icon} size={size} color={color} />;
  };

  const renderContent = () => {
    switch (active) {
      case "Chat":
        return <ChatInterface setActiveTab={setActive} />;
      case "Counselor":
        return <CounselorTable />;
      case "Wallet":
        return <WalletDashboard />;
      case "Video":
        return <CallHistory />;
      case "profile":
        return <PatientProfile />;
      case "help":
        return (
          <ScrollView style={styles.contentScrollable} showsVerticalScrollIndicator={false}>
            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Help & Support</Text>
              <View style={styles.helpContent}>
                <TouchableOpacity style={styles.supportCard}>
                  <MaterialIcons name="help" size={32} color="#667eea" />
                  <Text style={styles.supportCardTitle}>FAQ</Text>
                  <Text style={styles.supportCardText}>Find answers to frequently asked questions</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.supportCard}>
                  <MaterialIcons name="email" size={32} color="#667eea" />
                  <Text style={styles.supportCardTitle}>Contact Support</Text>
                  <Text style={styles.supportCardText}>Email us at support@example.com</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        );
      case "privacy":
        return (
          <ScrollView style={styles.contentScrollable} showsVerticalScrollIndicator={false}>
            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Privacy Settings</Text>
              <View style={styles.privacyContent}>
                <View style={styles.privacyOption}>
                  <Text style={styles.privacyOptionTitle}>Data Privacy</Text>
                  <Text style={styles.privacyOptionText}>Control how your data is used and shared</Text>
                  <TouchableOpacity style={styles.privacyBtn}>
                    <Text style={styles.privacyBtnText}>Manage Settings</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.privacyOption}>
                  <Text style={styles.privacyOptionTitle}>Session Privacy</Text>
                  <Text style={styles.privacyOptionText}>Configure privacy settings for your sessions</Text>
                  <TouchableOpacity style={styles.privacyBtn}>
                    <Text style={styles.privacyBtnText}>Configure</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        );
      default:
        return (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Welcome, {userData.name}!</Text>
            <Text style={styles.placeholderText}>Select an option from the menu to get started.</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* StatusBar with no background - let it be transparent */}
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="transparent" 
        translucent={true}
      />
      
      {/* Call Modals */}
      <CallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        callType={callType}
        callerName={callerInfo.userName || callerInfo.name}
        callerImage={callerInfo.image}
        callData={callerInfo}
        onAcceptCall={handleAcceptCall}
        onRejectCall={handleRejectCall}
      />

      <VideoCallModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        callData={selectedCall}
        onEndCall={() => {}}
      />

      <VoiceCallModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        callData={selectedCall}
        onEndCall={() => {}}
      />

      {/* Mobile Header - Starts below status bar, no background above WiFi */}
      {isMobile && (
        <Animated.View 
          style={[
            styles.mobileHeader,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }]
            }
          ]}
        >
            {/* Improved Professional Header with solid background */}
            <View style={styles.mobileHeaderBackground}>
              <View style={styles.mobileHeaderContent}>
                <View style={styles.mobileHeaderLeft}>
                  <View style={styles.logoWrapper}>
                    <Text style={styles.mobileLogo}>
                      M-<Text style={styles.mobileLogoHighlight}>Chatbot</Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.headerIconsSection}>
                  <Ionicons name="videocam" size={20} color="white" style={styles.headerIcon} />
                  <Ionicons name="battery-full" size={20} color="white" style={styles.headerIcon} />
                  <Ionicons name="phone-portrait" size={20} color="white" style={styles.headerIcon} />
                  <TouchableOpacity
                    style={styles.mobileProfileBtn}
                    onPress={() => setShowProfileMenu(!showProfileMenu)}
                  >
                    {userData.profilePhoto ? (
                      <Image source={{ uri: userData.profilePhoto }} style={styles.mobileUserAvatar} />
                    ) : (
                      <View style={styles.profileAvatarPlaceholder}>
                        <Text style={styles.profileAvatarText}>
                          {userData.name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          {showProfileMenu && (
            <Animated.View style={[styles.profileDropdownMenu, { opacity: headerAnim }]}>
              <View style={styles.profileDropdownHeader}>
                {userData.profilePhoto ? (
                  <Image source={{ uri: userData.profilePhoto }} style={styles.dropdownAvatar} />
                ) : (
                  <View style={styles.dropdownAvatarPlaceholder}>
                    <Text style={styles.dropdownAvatarText}>
                      {userData.name?.charAt(0) || 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.dropdownUserInfo}>
                  <Text style={styles.dropdownUserName}>{userData.name}</Text>
                  <Text style={styles.dropdownUserEmail}>{userData.email}</Text>
                </View>
              </View>
              <View style={styles.profileDropdownItems}>
                <TouchableOpacity style={styles.dropdownItem} onPress={handleProfileClick}>
                  <MaterialIcons name="person" size={18} color="#667eea" />
                  <Text style={styles.dropdownItemText}>My Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dropdownItem}>
                  <MaterialIcons name="settings" size={18} color="#667eea" />
                  <Text style={styles.dropdownItemText}>Settings</Text>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity
                  style={[styles.dropdownItem, styles.logoutItem]}
                  onPress={() => setShowLogoutConfirm(true)}
                >
                  <MaterialIcons name="logout" size={18} color="#dc2626" />
                  <Text style={[styles.dropdownItemText, styles.logoutText]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* Dashboard Container */}
      <View style={styles.dashboardContainer}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <View style={styles.userSidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sidebarContent}>
                <View style={styles.sidebarHeader}>
                  <View style={styles.profileSection}>
                    <View style={styles.profileImage}>
                      {userData.profilePhoto ? (
                        <Image source={{ uri: userData.profilePhoto }} style={styles.profileImageImg} />
                      ) : (
                        <View style={styles.profileImagePlaceholder}>
                          <Text style={styles.profileImagePlaceholderText}>
                            {userData.name?.charAt(0) || 'U'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.sidebarTitle}>
                        {userData.name}
                      </Text>
                      <Text style={styles.sidebarSubtitle}>
                        {userData.email}
                      </Text>
                      <View style={styles.memberBadge}>
                        <MaterialIcons name="verified" size={14} color="#667eea" />
                        <Text style={styles.memberBadgeText}>Premium Member</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.sidebarMenu}>
                  {allMenuItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleMenuItemClick(item.id)}
                      style={[styles.sidebarItem, active === item.id && styles.sidebarItemActive]}
                    >
                      <View style={[styles.sidebarIcon, active === item.id && styles.sidebarIconActive]}>
                        {renderIcon(item, active === item.id ? "white" : "#667eea")}
                      </View>
                      <Text style={[styles.sidebarText, active === item.id && styles.sidebarTextActive]}>
                        {item.label}
                      </Text>
                      {active === item.id && <View style={styles.activeIndicator} />}
                    </TouchableOpacity>
                  ))}
                  <View style={styles.sidebarDivider} />
                  <TouchableOpacity
                    style={[styles.sidebarItem, styles.logoutSidebarItem]}
                    onPress={() => setShowLogoutConfirm(true)}
                  >
                    <View style={styles.sidebarIcon}>
                      <MaterialIcons name="logout" size={18} color="#dc2626" />
                    </View>
                    <Text style={[styles.sidebarText, styles.logoutSidebarText]}>
                      Logout
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        {/* Dashboard Content */}
        <View style={[styles.dashboardContent, isMobile && styles.dashboardContentMobile]}>
          {renderContent()}
        </View>
      </View>

      {/* Chat Button */}
      {!isMobile && (
        <ChatButton onClick={() => setChatOpen(true)} unreadCount={unreadCount} />
      )}

      {/* Chat Popup */}
      {chatOpen && (
        <ChatPopup
          messages={chatMessages}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          sendMessage={sendMessage}
          isLoading={isLoading}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <View style={styles.mobileBottomNav}>
          {bottomMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.mobileNavBtn, active === item.id && styles.mobileNavBtnActive]}
              onPress={() => handleMenuItemClick(item.id)}
            >
              <View style={[styles.navIconWrapper, active === item.id && styles.navIconWrapperActive]}>
                {renderIcon(item, active === item.id ? "#667eea" : "#888")}
              </View>
              <Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.mobileNavBtn} onPress={() => setShowMoreModal(true)}>
            <View style={styles.navIconWrapper}>
              <MaterialIcons name="more-horiz" size={20} color="#888" />
            </View>
            <Text style={styles.navLabel}>More</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <Modal transparent={true} visible={showMoreModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Menu Options</Text>
              <TouchableOpacity onPress={() => setShowMoreModal(false)}>
                <Text style={styles.closeModalText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.moreOptionsList}>
                {allMenuItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.moreOptionItem, active === item.id && styles.moreOptionItemActive]}
                    onPress={() => handleMenuItemClick(item.id)}
                  >
                    <View style={styles.moreOptionIcon}>
                      {renderIcon(item, active === item.id ? "#667eea" : "#555")}
                    </View>
                    <Text style={styles.moreOptionText}>{item.label}</Text>
                    <MaterialIcons name="arrow-forward" size={14} color="#ccc" />
                  </TouchableOpacity>
                ))}
                <View style={styles.moreActions}>
                  <TouchableOpacity
                    style={styles.moreActionBtn}
                    onPress={() => {
                      setShowMoreModal(false);
                      setShowLogoutConfirm(true);
                    }}
                  >
                    <MaterialIcons name="logout" size={16} color="#dc2626" />
                    <Text style={styles.moreActionBtnText}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent={true} visible={showLogoutConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Logout</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalBodyText}>Are you sure you want to logout?</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDanger]} onPress={handleLogout}>
                <Text style={styles.modalBtnDangerText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent={true} visible={showDeleteConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalBodyText}>
                This action cannot be undone. All your data will be permanently deleted.
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={handleDeleteConfirm}
              >
                <Text style={styles.modalBtnDangerText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent={true} visible={deleteSuccess} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.successModal]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, styles.successTitle]}>
                <MaterialIcons name="check-circle" size={20} color="#10b981" /> Account Deleted!
              </Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalBodyText}>Your account has been successfully deleted.</Text>
              <Text style={styles.modalBodyText}>Redirecting...</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    marginTop:40
  },
  dashboardContainer: {
    flex: 1,
    flexDirection: "row",
   
  },
  // Sidebar Styles
  userSidebar: {
    width: 280,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
    borderRightWidth: 1,
    borderRightColor: "#eaeaea",
  },
  sidebarContent: {
    flex: 1,
    padding: 20,
  },
  sidebarHeader: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
  },
  profileSection: {
    alignItems: "center",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 15,
    borderWidth: 3,
    borderColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  profileImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImagePlaceholderText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
  },
  profileImageImg: {
    width: "100%",
    height: "100%",
  },
  profileInfo: {
    alignItems: "center",
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginVertical: 2,
  },
  sidebarSubtitle: {
    fontSize: 12,
    color: "#888",
    marginVertical: 1,
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  memberBadgeText: {
    fontSize: 11,
    color: "#667eea",
    fontWeight: "600",
  },
  sidebarMenu: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 5,
    position: "relative",
  },
  sidebarItemActive: {
    backgroundColor: "#667eea",
  },
  sidebarIcon: {
    width: 32,
    alignItems: "center",
    marginRight: 12,
  },
  sidebarIconActive: {
    transform: [{ scale: 1.1 }],
  },
  sidebarText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#555",
  },
  sidebarTextActive: {
    color: "white",
    fontWeight: "600",
  },
  activeIndicator: {
    position: "absolute",
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "white",
  },
  // Dashboard Content
  dashboardContent: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  dashboardContentMobile: {
    marginTop: 70,
    marginBottom: 70,
  },
  contentScrollable: {
    flex: 1,
  },
  // Content Sections
  contentSection: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    margin: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f0f0",
  },
  placeholderText: {
    color: "#666",
    fontSize: 14,
  },
  // Help & Support
  helpContent: {
    gap: 16,
  },
  supportCard: {
    backgroundColor: "#f8f9ff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eaeaea",
    marginBottom: 16,
  },
  supportCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 8,
  },
  supportCardText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  // Privacy
  privacyContent: {
    gap: 16,
  },
  privacyOption: {
    backgroundColor: "#f8f9ff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#eaeaea",
    marginBottom: 16,
  },
  privacyOptionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  privacyOptionText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 15,
  },
  privacyBtn: {
    backgroundColor: "#667eea",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  privacyBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "500",
  },
  // Mobile Header - No background above, starts below status bar
  mobileHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#4a69bd", // Solid professional background
  },
  mobileHeaderBackground: {
    backgroundColor: "#4a69bd",
    width: "100%",
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight || 40,
    paddingBottom: 15,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerIconsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  headerIcon: {
    opacity: 0.9,
  },
  mobileHeaderContent: {
    flexDirection: "row",
    
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileLogo: {
    fontSize: 20,
    fontWeight: "800",
    color: "white",
  },
  mobileLogoHighlight: {
    color: "#FFD700",
  },
  mobileHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  notificationBtn: {
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -8,
    backgroundColor: "#FF4757",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  notificationBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  mobileProfileBtn: {
    padding: 0,
  },
  mobileUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "white",
  },
  profileAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  profileAvatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  // Profile Dropdown
  profileDropdownMenu: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 80,
    right: 16,
    width: 300,
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1001,
  },
  profileDropdownHeader: {
    padding: 20,
    backgroundColor: "#667eea",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  dropdownAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "white",
  },
  dropdownAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  dropdownAvatarText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },
  dropdownUserInfo: {
    flex: 1,
  },
  dropdownUserName: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  dropdownUserEmail: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
  profileDropdownItems: {
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
  logoutItem: {
    backgroundColor: "#fff5f5",
  },
  logoutText: {
    color: "#dc2626",
  },
  // Mobile Bottom Nav
  mobileBottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 30 : 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    zIndex: 998,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  mobileNavBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 8,
  },
  mobileNavBtnActive: {
    backgroundColor: "#f0f0f0",
  },
  navIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  navIconWrapperActive: {
    backgroundColor: "#f0f0f0",
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#888",
  },
  navLabelActive: {
    color: "#667eea",
    fontWeight: "600",
  },
  // Chat Components
  floatingChatBtn: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    backgroundColor: "#667eea",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  floatingChatBtnText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  unreadBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ff4757",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "white",
  },
  logoutSidebarItem: {
    marginTop: 20,
    backgroundColor: "#fff5f5",
  },
  logoutSidebarText: {
    color: "#dc2626",
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 10,
    marginHorizontal: 15,
  },
  unreadBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  chatPopupOverlay: {
    position: "absolute",
    bottom: 90,
    right: 20,
    left: 20,
    zIndex: 1000,
  },
  chatPopup: {
    backgroundColor: "white",
    borderRadius: 16,
    height: 450,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  chatPopupHeader: {
    padding: 15,
    backgroundColor: "#667eea",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  chatAvatarSmall: {
    width: 30,
    height: 30,
  },
  chatHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  chatStatus: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  chatCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  chatCloseText: {
    fontSize: 24,
    color: "white",
  },
  chatPopupBody: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f8f9fa",
  },
  chatMessageWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    maxWidth: "85%",
  },
  chatMessageWrapperUser: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  chatMessageWrapperAi: {
    alignSelf: "flex-start",
  },
  chatBubble: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#eaeaea",
    maxWidth: "100%",
  },
  chatBubbleUser: {
    backgroundColor: "#667eea",
    borderColor: "#667eea",
  },
  chatBubbleText: {
    fontSize: 13,
    color: "#333",
  },
  chatBubbleTextUser: {
    color: "white",
  },
  chatPopupFooter: {
    padding: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eaeaea",
    flexDirection: "row",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    fontSize: 13,
  },
  sendBtn: {
    width: 38,
    height: 38,
    backgroundColor: "#667eea",
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 4,
  },
  loadingDot: {
    width: 6,
    height: 6,
    backgroundColor: "#667eea",
    borderRadius: 3,
  },
  // Call Modal Styles
  callModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  callModal: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    width: width * 0.9,
    maxWidth: 360,
    overflow: "hidden",
  },
  callModalContent: {
    padding: 24,
    alignItems: "center",
  },
  callerInfo: {
    alignItems: "center",
    marginBottom: 24,
  },
  callerAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  callerAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 45,
  },
  callerName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e1b3a",
    marginBottom: 4,
  },
  callType: {
    fontSize: 14,
    color: "#667eea",
  },
  callControls: {
    flexDirection: "row",
    gap: 16,
  },
  callBtn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 40,
    minWidth: 100,
  },
  acceptBtn: {
    backgroundColor: "#22c55e",
  },
  rejectBtn: {
    backgroundColor: "#ef4444",
  },
  callBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  // Video Call Modal
  videoCallModalOverlay: {
    flex: 1,
    backgroundColor: "black",
  },
  videoCallModal: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  remoteVideoPlaceholder: {
    alignItems: "center",
  },
  remoteAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  remoteName: {
    color: "white",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 10,
  },
  videoLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  videoLoadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  localVideoPreview: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 100,
    height: 140,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#667eea",
  },
  localVideoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  localVideoText: {
    color: "white",
    fontSize: 12,
    marginTop: 4,
  },
  videoCallControls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  videoCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  endCallBtn: {
    backgroundColor: "#ef4444",
  },
  // Voice Call Modal
  voiceCallModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceCallModal: {
    backgroundColor: "#1a1a2e",
    borderRadius: 32,
    padding: 40,
    width: width * 0.85,
    maxWidth: 400,
  },
  voiceCallContent: {
    alignItems: "center",
  },
  voiceCallerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  voiceAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  voiceCallerName: {
    fontSize: 24,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  voiceCallStatus: {
    fontSize: 14,
    color: "#667eea",
    marginBottom: 32,
  },
  voiceCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    width: width * 0.85,
    maxWidth: 400,
    overflow: "hidden",
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  closeModalText: {
    fontSize: 24,
    color: "#999",
  },
  modalBody: {
    padding: 20,
  },
  modalBodyText: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eaeaea",
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalBtnSecondary: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modalBtnSecondaryText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "500",
  },
  modalBtnDanger: {
    backgroundColor: "#ef4444",
  },
  modalBtnDangerText: {
    color: "white",
    fontSize: 13,
    fontWeight: "500",
  },
  successModal: {
    backgroundColor: "#d4edda",
  },
  successTitle: {
    color: "#10b981",
  },
  // More Options Modal
  moreOptionsList: {
    paddingVertical: 8,
  },
  moreOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  moreOptionItemActive: {
    backgroundColor: "#f8f9ff",
  },
  moreOptionIcon: {
    width: 28,
    marginRight: 12,
  },
  moreOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
  },
  moreActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  moreActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  moreActionBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#dc2626",
  },
});