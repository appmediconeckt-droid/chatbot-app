// CounselorDirectoryScreen.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Modal,
  ScrollView,
  Dimensions,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import DateTimePicker from '@react-native-community/datetimepicker';
import api, { API_BASE_URL } from "../../../../../../axiosConfig";

const { width, height } = Dimensions.get("window");

// Utility Functions
const getInitials = (name = "Counselor") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CO";

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

const getProfilePhotoUrl = (counselor) => {
  if (!counselor) return null;
  
  if (counselor.profilePhoto) {
    if (typeof counselor.profilePhoto === "string") {
      if (counselor.profilePhoto.startsWith("http")) {
        return counselor.profilePhoto;
      }
      return `${API_BASE_URL}${counselor.profilePhoto}`;
    }
    if (counselor.profilePhoto.url) {
      if (counselor.profilePhoto.url.startsWith("http")) {
        return counselor.profilePhoto.url;
      }
      return `${API_BASE_URL}${counselor.profilePhoto.url}`;
    }
  }
  
  if (counselor.avatar) {
    if (counselor.avatar.startsWith("http")) {
      return counselor.avatar;
    }
    return `${API_BASE_URL}${counselor.avatar}`;
  }
  
  return null;
};

const CounselorDirectoryScreen = ({ navigation }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("online");
  const [counselorsData, setCounselorsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [bookingDate, setBookingDate] = useState(new Date());
  const [bookingNotes, setBookingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAnonymous, setUserAnonymous] = useState("");
  const [uniqueLocations, setUniqueLocations] = useState([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const socketRef = useRef(null);

  // Get user data
  useEffect(() => {
    const getUserData = async () => {
      try {
        const storedAnonymous = await AsyncStorage.getItem("userAnonymousName");
        if (storedAnonymous) {
          setUserAnonymous(storedAnonymous);
        } else {
          const userId = await AsyncStorage.getItem("userId");
          if (userId) {
            try {
              const response = await api.get(`/api/auth/getUser/${userId}`);
              if (response.data.success && response.data.user) {
                const anonymousName = response.data.user.anonymous || response.data.user.fullName || response.data.user.name || `Anonymous_${Math.floor(Math.random() * 10000)}`;
                setUserAnonymous(anonymousName);
                await AsyncStorage.setItem("userAnonymousName", anonymousName);
                return;
              }
            } catch (err) {
              console.error("Error fetching user:", err);
            }
          }
          const anonymousName = `Anonymous_${Math.floor(Math.random() * 10000)}`;
          setUserAnonymous(anonymousName);
          await AsyncStorage.setItem("userAnonymousName", anonymousName);
        }
      } catch (error) {
        console.error("Error getting user data:", error);
        const anonymousName = `Anonymous_${Math.floor(Math.random() * 10000)}`;
        setUserAnonymous(anonymousName);
      }
    };
    getUserData();
  }, []);

  // Fetch counselors using the api instance
  const fetchCounselors = useCallback(async () => {
    try {
      setError("");
      setIsLoading(true);
      
      console.log("Fetching counselors from:", `${API_BASE_URL}/api/auth/counsellors`);
      
      const response = await api.get("/api/auth/counsellors");
      console.log("Response status:", response.status);
      
      let counselors = [];
      if (response.data?.counsellors) {
        counselors = response.data.counsellors;
      } else if (response.data?.counselors) {
        counselors = response.data.counselors;
      } else if (Array.isArray(response.data)) {
        counselors = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        counselors = response.data.data;
      }
      
      console.log("Number of counselors fetched:", counselors.length);
      
      const formattedCounselors = counselors.map((c, index) => {
        const profilePhotoUrl = getProfilePhotoUrl(c);
        
        return {
          id: c._id || c.id || index.toString(),
          name: c.fullName || c.name || "Counselor",
          specialization: Array.isArray(c.specialization) ? c.specialization.join(", ") : (c.specialization || "General"),
          experience: c.experience || 0,
          rating: c.rating || 4.5,
          online: c.isOnline || false,
          available: c.isActive !== false,
          lastSeen: c.lastSeen || null,
          profilePhoto: profilePhotoUrl,
          avatarType: profilePhotoUrl ? "image" : "text",
          expertise: Array.isArray(c.specialization) ? c.specialization : (c.specialization ? [c.specialization] : []),
          responseTime: c.responseTime || "< 10 seconds",
          email: c.email,
          phone: c.phoneNumber,
          location: c.location || "Online",
          languages: c.languages || [],
          aboutMe: c.aboutMe,
          qualification: c.qualification,
          totalSessions: c.totalSessions || 0,
        };
      });
      
      setCounselorsData(formattedCounselors);
      
      const locations = [...new Set(
        formattedCounselors
          .map(c => c.location)
          .filter(l => l && l !== "Online" && l.trim())
      )];
      setUniqueLocations(locations);
      
    } catch (err) {
      console.error("Failed to fetch counselors:", err);
      setError(err.response?.data?.message || "Unable to load counselors right now. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounselors();
  }, [fetchCounselors]);

  // Socket connection for real-time updates
  useEffect(() => {
    let socket = null;
    
    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem("accessToken") || await AsyncStorage.getItem("token");
        if (!token) {
          console.log("No token found, skipping socket connection");
          return;
        }

        socket = io(API_BASE_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });
        
        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("Socket connected successfully");
        });

        socket.on("presence-update", ({ userId, isOnline, lastSeen }) => {
          setCounselorsData((prev) =>
            prev.map((counselor) =>
              String(counselor.id) === String(userId)
                ? { ...counselor, online: isOnline, lastSeen }
                : counselor
            )
          );
        });

        socket.on("connect_error", (err) => {
          console.error("Socket connection error:", err.message);
        });

      } catch (error) {
        console.error("Error setting up socket:", error);
      }
    };

    setupSocket();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCounselors();
    setRefreshing(false);
  }, [fetchCounselors]);

  const allTreatments = useMemo(() => {
    const treatments = new Set();
    counselorsData.forEach((counselor) => {
      normalizeArray(counselor.expertise).forEach((item) => {
        if (item && item.trim()) treatments.add(item.trim());
      });
    });
    return Array.from(treatments).sort();
  }, [counselorsData]);

  const filteredAndSortedCounselors = useMemo(() => {
    let filtered = counselorsData.filter((counselor) => {
      const name = (counselor.name || "").toLowerCase();
      const specialization = (counselor.specialization || "").toLowerCase();
      const aboutMe = (counselor.aboutMe || "").toLowerCase();
      const location = (counselor.location || "").toLowerCase();
      const languages = (counselor.languages || []).join(" ").toLowerCase();
      const expertise = (counselor.expertise || []).join(" ").toLowerCase();
      
      const searchableText = `${name} ${specialization} ${aboutMe} ${location} ${languages} ${expertise}`;
      const matchesSearch = searchTerm === "" || searchableText.includes(searchTerm.toLowerCase());
      
      const matchesLocation = searchLocation === "" || location.includes(searchLocation.toLowerCase());
      
      const matchesCategory = selectedCategory === "all" || 
        (counselor.expertise && counselor.expertise.some(s => 
          s.toLowerCase() === selectedCategory.toLowerCase()
        ));

      return matchesSearch && matchesLocation && matchesCategory;
    });

    filtered.sort((a, b) => {
      if (sortBy === "online") return Number(b.online) - Number(a.online);
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "experience") return (b.experience || 0) - (a.experience || 0);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });

    return filtered;
  }, [counselorsData, searchTerm, searchLocation, selectedCategory, sortBy]);

  const handleImageError = (counselorId) => {
    setImageErrors(prev => ({ ...prev, [counselorId]: true }));
  };

  // Send chat request - Handle existing chat gracefully
  const handleSendChatRequest = async () => {
    if (!selectedCounselor) return;

    setIsSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("accessToken") || await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please login to start a chat");
        setIsSubmitting(false);
        return;
      }

      const response = await api.post("/api/chat/start", {
        counselorId: selectedCounselor.id,
      });

      console.log("Chat request response:", response.data);

      // Handle existing chat case
      if (response.data.error === "Chat already active. Please continue your conversation." || 
          response.data.status === "accepted" ||
          response.data.chatId) {
        
        const chatId = response.data.chatId;
        Alert.alert(
          "Chat Available",
          `You already have an active chat with ${selectedCounselor.name}. Would you like to continue?`,
          [
            { 
              text: "Cancel", 
              style: "cancel",
              onPress: () => {
                setShowChatModal(false);
                resetChatForm();
              }
            },
            { 
              text: "Continue Chat", 
              onPress: () => {
                setShowChatModal(false);
                resetChatForm();
                navigation.navigate("Chat", {
                  chatId: chatId,
                  counselorId: selectedCounselor.id,
                  counselor: selectedCounselor,
                  userAnonymous: userAnonymous,
                });
              }
            }
          ]
        );
      } 
      // Handle successful new chat request
      else if (response.data.success || response.data.message === "Chat request sent successfully") {
        Alert.alert(
          "Success",
          `Chat request sent to ${selectedCounselor.name}! You'll be notified when they accept.`,
          [{ 
            text: "OK", 
            onPress: () => {
              setShowChatModal(false);
              resetChatForm();
            }
          }]
        );
      } 
      else {
        Alert.alert("Error", response.data?.message || "Failed to send chat request");
      }
    } catch (error) {
      console.error("Chat request error:", error);
      console.error("Error response:", error.response?.data);
      
      // Handle error response from server
      if (error.response?.data?.error === "Chat already active. Please continue your conversation." ||
          error.response?.data?.status === "accepted") {
        
        const chatId = error.response?.data?.chatId;
        Alert.alert(
          "Chat Available",
          `You already have an active chat with ${selectedCounselor.name}. Would you like to continue?`,
          [
            { 
              text: "Cancel", 
              style: "cancel",
              onPress: () => {
                setShowChatModal(false);
                resetChatForm();
              }
            },
            { 
              text: "Continue Chat", 
              onPress: () => {
                setShowChatModal(false);
                resetChatForm();
                navigation.navigate("Chat", {
                  chatId: chatId,
                  counselorId: selectedCounselor.id,
                  counselor: selectedCounselor,
                  userAnonymous: userAnonymous,
                });
              }
            }
          ]
        );
      } else {
        let errorMessage = "Failed to send chat request";
        if (error.response?.status === 401) {
          errorMessage = "Please login again to chat";
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        Alert.alert("Error", errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Book appointment - Handle success properly
  const handleConfirmBooking = async () => {
    if (!bookingDate) {
      Alert.alert("Error", "Please select a date and time");
      return;
    }
    if (!bookingNotes.trim()) {
      Alert.alert("Error", "Please provide some notes about your concern");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("accessToken") || await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please login to book an appointment");
        setIsSubmitting(false);
        return;
      }

      const formattedDate = bookingDate.toISOString();
      
      const response = await api.post("/api/appointments", {
        counselorId: selectedCounselor.id,
        date: formattedDate,
        notes: bookingNotes,
      });

      console.log("Booking response:", response.data);

      // Check if appointment was created successfully
      if (response.data._id || response.data.success || response.data.message === "Appointment booked successfully") {
        Alert.alert(
          "Success",
          "Appointment booked successfully! The counselor has been notified.",
          [{ 
            text: "OK", 
            onPress: () => {
              setShowBookingModal(false);
              resetBookingForm();
            }
          }]
        );
      } else {
        Alert.alert("Error", response.data?.message || "Failed to book appointment");
      }
    } catch (error) {
      console.error("Booking error:", error);
      
      let errorMessage = "Failed to book appointment";
      if (error.response?.status === 401) {
        errorMessage = "Please login again to book";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBookingForm = () => {
    setBookingDate(new Date());
    setBookingNotes("");
    setSelectedCounselor(null);
  };

  const resetChatForm = () => {
    setSelectedCounselor(null);
  };

  const renderCounselorCard = ({ item: counselor }) => {
    const name = counselor.name || "Counselor";
    const location = counselor.location || "Online";
    const hasImageError = imageErrors[counselor.id];
    const profilePhotoUrl = !hasImageError ? counselor.profilePhoto : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            {profilePhotoUrl ? (
              <Image 
                source={{ uri: profilePhotoUrl }} 
                style={styles.avatar}
                onError={() => handleImageError(counselor.id)}
              />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.initialsText}>{getInitials(name)}</Text>
              </View>
            )}
            <View style={[styles.presenceDot, counselor.online ? styles.online : styles.offline]} />
          </View>
          
          <View style={styles.counselorInfo}>
            <Text style={styles.counselorName}>{name}</Text>
            <Text style={styles.specialization} numberOfLines={1}>
              {counselor.specialization}
            </Text>
            {location !== "Online" && (
              <Text style={styles.locationText}>📍 {location}</Text>
            )}
          </View>
          
          <View style={[styles.availabilityBadge, counselor.online && styles.availabilityOnline]}>
            <Text style={styles.availabilityText}>
              {counselor.online ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.tagsContainer}>
          {counselor.expertise && counselor.expertise.slice(0, 3).map((spec, idx) => (
            <View key={idx} style={styles.tag}>
              <Text style={styles.tagText}>{spec}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.statValue}>★ {counselor.rating?.toFixed(1) || "0"}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Experience</Text>
            <Text style={styles.statValue}>{counselor.experience || 0}y</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Response</Text>
            <Text style={styles.statValue}>{counselor.responseTime || "< 10s"}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.languagesContainer}>
            {counselor.languages && counselor.languages.slice(0, 2).map((lang, idx) => (
              <Text key={idx} style={styles.language}>{lang}</Text>
            ))}
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.chatBtn, !counselor.available && styles.disabledBtn]}
              onPress={() => {
                setSelectedCounselor(counselor);
                setShowChatModal(true);
              }}
              disabled={!counselor.available}
            >
              <Text style={styles.actionBtnText}>
                {counselor.available ? "💬 Chat Now" : "🔴 Unavailable"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.bookBtn]}
              onPress={() => {
                setSelectedCounselor(counselor);
                setShowBookingModal(true);
              }}
            >
              <Text style={styles.actionBtnText}>📅 Book</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading counselors...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <FlatList
        data={filteredAndSortedCounselors}
        renderItem={renderCounselorCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            {/* Search Section */}
            <View style={styles.searchSection}>
              <View style={styles.searchWrapper}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, specialization..."
                  placeholderTextColor="#94A3B8"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
                {searchTerm.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchTerm("")}>
                    <Text style={styles.searchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.locationWrapper}>
                <Text style={styles.locationIcon}>📍</Text>
                <TextInput
                  style={styles.locationInput}
                  placeholder="Search by location..."
                  placeholderTextColor="#94A3B8"
                  value={searchLocation}
                  onChangeText={(text) => {
                    setSearchLocation(text);
                    setShowLocationDropdown(true);
                  }}
                  onFocus={() => setShowLocationDropdown(true)}
                />
                {searchLocation.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchLocation("")}>
                    <Text style={styles.searchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Location Dropdown */}
              {showLocationDropdown && uniqueLocations.length > 0 && searchLocation.length > 0 && (
                <View style={styles.locationDropdown}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {uniqueLocations
                      .filter(location => 
                        location.toLowerCase().includes(searchLocation.toLowerCase())
                      )
                      .map((location, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.locationOption}
                          onPress={() => {
                            setSearchLocation(location);
                            setShowLocationDropdown(false);
                          }}
                        >
                          <Text>📍 {location}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {/* Filter Stats */}
              {(searchTerm || searchLocation || selectedCategory !== "all") && (
                <View style={styles.filterStats}>
                  <Text style={styles.filterCount}>
                    Found {filteredAndSortedCounselors.length} counselor(s)
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setSearchTerm("");
                    setSearchLocation("");
                    setSelectedCategory("all");
                  }}>
                    <Text style={styles.clearFilters}>Clear Filters</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Filter Chips */}
            {allTreatments.length > 0 && (
              <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCategory === "all" && styles.filterChipActive]}
                    onPress={() => setSelectedCategory("all")}
                  >
                    <Text style={[styles.filterChipText, selectedCategory === "all" && styles.filterChipTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {allTreatments.slice(0, 12).map((treatment) => (
                    <TouchableOpacity
                      key={treatment}
                      style={[styles.filterChip, selectedCategory === treatment && styles.filterChipActive]}
                      onPress={() => setSelectedCategory(treatment)}
                    >
                      <Text style={[styles.filterChipText, selectedCategory === treatment && styles.filterChipTextActive]}>
                        {treatment}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Sort Bar */}
            <View style={styles.sortBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {["online", "name", "rating", "experience"].map((sort) => (
                  <TouchableOpacity
                    key={sort}
                    style={[styles.sortBtn, sortBy === sort && styles.sortBtnActive]}
                    onPress={() => setSortBy(sort)}
                  >
                    <Text style={[styles.sortBtnText, sortBy === sort && styles.sortBtnTextActive]}>
                      {sort.charAt(0).toUpperCase() + sort.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchCounselors}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {filteredAndSortedCounselors.length === 0 && !error && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No counselors found</Text>
                <Text style={styles.emptyText}>Try adjusting your search or filter</Text>
                <TouchableOpacity style={styles.resetButton} onPress={() => {
                  setSearchTerm("");
                  setSearchLocation("");
                  setSelectedCategory("all");
                }}>
                  <Text style={styles.resetButtonText}>Clear all filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Booking Modal */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowBookingModal(false);
          resetBookingForm();
        }}
      >
        <KeyboardAvoidingView behavior="height" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book Appointment with {selectedCounselor?.name}</Text>
              <TouchableOpacity onPress={() => {
                setShowBookingModal(false);
                resetBookingForm();
              }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Date and Time</Text>
                <DateTimePicker
                  value={bookingDate}
                  mode="datetime"
                  display="default"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setBookingDate(selectedDate);
                    }
                  }}
                  minimumDate={new Date()}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Clinical Notes / Reason (Required)</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Share what you'd like to discuss..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  value={bookingNotes}
                  onChangeText={setBookingNotes}
                />
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>⏳ Appointment will be sent for confirmation</Text>
                <Text style={styles.infoText}>✅ Counselor will be notified instantly</Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleConfirmBooking}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Booking..." : "Confirm Appointment"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Request Modal */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowChatModal(false);
          resetChatForm();
        }}
      >
        <KeyboardAvoidingView behavior="height" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start Chat with {selectedCounselor?.name}</Text>
              <TouchableOpacity onPress={() => {
                setShowChatModal(false);
                resetChatForm();
              }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.userInfoCard}>
                <Text style={styles.userInfoIcon}>🔒</Text>
                <View style={styles.userInfoDetails}>
                  <Text style={styles.userInfoLabel}>You are chatting anonymously as:</Text>
                  <Text style={styles.userInfoName}>{userAnonymous || "Anonymous"}</Text>
                  <Text style={styles.userInfoNote}>This anonymous name will be shown to the counselor</Text>
                </View>
              </View>

              {selectedCounselor && (
                <View style={styles.counselorPreview}>
                  <View style={styles.counselorPreviewHeader}>
                    <View style={styles.counselorPreviewAvatar}>
                      {selectedCounselor.profilePhoto && !imageErrors[selectedCounselor.id] ? (
                        <Image 
                          source={{ uri: selectedCounselor.profilePhoto }} 
                          style={styles.previewAvatarImage}
                          onError={() => handleImageError(selectedCounselor.id)}
                        />
                      ) : (
                        <View style={styles.previewAvatarText}>
                          <Text>{getInitials(selectedCounselor.name)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.counselorPreviewInfo}>
                      <Text style={styles.counselorPreviewName}>{selectedCounselor.name}</Text>
                      <Text style={styles.counselorPreviewSpecialization}>{selectedCounselor.specialization}</Text>
                      {selectedCounselor.location && selectedCounselor.location !== "Online" && (
                        <Text style={styles.counselorPreviewLocation}>📍 {selectedCounselor.location}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>⏳ Your request will be sent to the counselor</Text>
                <Text style={styles.infoText}>✅ You'll be notified when they accept</Text>
                <Text style={styles.infoText}>💬 Average response time: {selectedCounselor?.responseTime || "< 10 seconds"}</Text>
                <Text style={[styles.infoText, styles.privacyNote]}>🔒 You are chatting anonymously. Your real identity is protected.</Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSendChatRequest}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Sending..." : "Send Chat Request"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
  },
  listContent: {
    paddingBottom: 20,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  locationWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
    color: "#94A3B8",
  },
  locationIcon: {
    fontSize: 18,
    marginRight: 8,
    color: "#94A3B8",
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#0F172A",
    paddingVertical: 8,
  },
  locationInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#0F172A",
    paddingVertical: 8,
  },
  searchClear: {
    fontSize: 18,
    color: "#94A3B8",
    fontWeight: "600",
    padding: 6,
  },
  locationDropdown: {
    position: "absolute",
    top: 110,
    left: 20,
    right: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  locationOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  filterCount: {
    fontSize: 13,
    color: "#64748B",
  },
  clearFilters: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "600",
  },
  filtersContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#6366F1",
  },
  filterChipText: {
    fontSize: 14,
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sortBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  sortBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  sortBtnActive: {
    backgroundColor: "#6366F1",
  },
  sortBtnText: {
    fontSize: 13,
    color: "#475569",
  },
  sortBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E2E8F0",
  },
  avatarInitials: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  initialsText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  presenceDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  online: {
    backgroundColor: "#10B981",
  },
  offline: {
    backgroundColor: "#94A3B8",
  },
  counselorInfo: {
    flex: 1,
  },
  counselorName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 2,
  },
  specialization: {
    fontSize: 13,
    color: "#64748B",
  },
  locationText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  availabilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  availabilityOnline: {
    backgroundColor: "#D1FAE5",
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#475569",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
  },
  tagText: {
    fontSize: 11,
    color: "#6366F1",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  languagesContainer: {
    flexDirection: "row",
    gap: 8,
  },
  language: {
    fontSize: 11,
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chatBtn: {
    backgroundColor: "#10B981",
  },
  bookBtn: {
    backgroundColor: "#6366F1",
  },
  disabledBtn: {
    backgroundColor: "#94A3B8",
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#6366F1",
    borderRadius: 8,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#6366F1",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: width * 0.9,
    maxHeight: height * 0.85,
    padding: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
    flex: 1,
  },
  modalClose: {
    fontSize: 24,
    color: "#94A3B8",
    fontWeight: "500",
    padding: 4,
  },
  inputGroup: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0F172A",
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
    height: 100,
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
  },
  infoBox: {
    margin: 20,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoText: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 8,
  },
  privacyNote: {
    color: "#6366F1",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: "#6366F1",
    padding: 16,
    borderRadius: 8,
    margin: 20,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  userInfoCard: {
    flexDirection: "row",
    margin: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  userInfoIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  userInfoDetails: {
    flex: 1,
  },
  userInfoLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  userInfoName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6366F1",
    marginBottom: 4,
  },
  userInfoNote: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  counselorPreview: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
  },
  counselorPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  counselorPreviewAvatar: {
    marginRight: 12,
  },
  previewAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  previewAvatarText: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  counselorPreviewInfo: {
    flex: 1,
  },
  counselorPreviewName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 2,
  },
  counselorPreviewSpecialization: {
    fontSize: 13,
    color: "#6366F1",
    marginBottom: 2,
  },
  counselorPreviewLocation: {
    fontSize: 12,
    color: "#64748B",
  },
});

// Export for Android only - single default export
export default CounselorDirectoryScreen;