import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

const { width, height } = Dimensions.get('window');

const CounselorTable = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  // Enhanced sample data with more fields for richness
  const counselorsData = [
    {
      id: 1,
      name: "Dr. Priya Sharma",
      specialization: "Clinical Psychologist",
      treatmentTypes: ["Depression", "Anxiety", "Stress", "Trauma"],
      experience: "12 yrs",
      languages: ["Hindi", "English"],
      rating: 4.8,
      fee: "₹1200",
      availability: "Today",
      patients: 1240,
      avatar: "PS"
    },
    {
      id: 2,
      name: "Dr. Rajesh Kumar",
      specialization: "Psychiatrist",
      treatmentTypes: ["Bipolar", "Schizophrenia", "OCD", "ADHD"],
      experience: "15 yrs",
      languages: ["Hindi", "English", "Urdu"],
      rating: 4.9,
      fee: "₹1500",
      availability: "Tomorrow",
      patients: 2350,
      avatar: "RK"
    },
    {
      id: 3,
      name: "Dr. Sneha Patel",
      specialization: "Child Psychologist",
      treatmentTypes: ["Autism", "ADHD", "Learning", "Behavioral"],
      experience: "8 yrs",
      languages: ["Gujarati", "Hindi", "English"],
      rating: 4.7,
      fee: "₹1000",
      availability: "Today",
      patients: 890,
      avatar: "SP"
    },
    {
      id: 4,
      name: "Dr. Amit Verma",
      specialization: "Marriage Counselor",
      treatmentTypes: ["Relationship", "Couple", "Divorce", "Family"],
      experience: "10 yrs",
      languages: ["Hindi", "English", "Bengali"],
      rating: 4.6,
      fee: "₹1100",
      availability: "Now",
      patients: 1560,
      avatar: "AV"
    },
    {
      id: 5,
      name: "Dr. Neha Gupta",
      specialization: "Addiction Counselor",
      treatmentTypes: ["Substance", "Alcohol", "Gambling", "Recovery"],
      experience: "9 yrs",
      languages: ["Hindi", "English", "Marathi"],
      rating: 4.9,
      fee: "₹1300",
      availability: "Today",
      patients: 980,
      avatar: "NG"
    },
    {
      id: 6,
      name: "Dr. Vikram Singh",
      specialization: "Trauma Specialist",
      treatmentTypes: ["PTSD", "Childhood Trauma", "Abuse", "Grief"],
      experience: "14 yrs",
      languages: ["Hindi", "English", "Punjabi"],
      rating: 4.8,
      fee: "₹1400",
      availability: "Tomorrow",
      patients: 1870,
      avatar: "VS"
    },
    {
      id: 7,
      name: "Dr. Anjali Mehta",
      specialization: "Cognitive Therapist",
      treatmentTypes: ["Anxiety", "Depression", "Phobias", "Panic"],
      experience: "11 yrs",
      languages: ["Hindi", "English", "Sanskrit"],
      rating: 4.8,
      fee: "₹1250",
      availability: "Today",
      patients: 1430,
      avatar: "AM"
    },
    {
      id: 8,
      name: "Dr. Suresh Reddy",
      specialization: "Neuro Psychologist",
      treatmentTypes: ["Memory Issues", "Brain Injury", "Dementia", "Stroke"],
      experience: "16 yrs",
      languages: ["Telugu", "Hindi", "English"],
      rating: 4.9,
      fee: "₹1600",
      availability: "Now",
      patients: 2120,
      avatar: "SR"
    }
  ];

  // All treatment types (used for filter chips)
  const allTreatments = [
    "Depression", "Anxiety", "Stress", "Trauma", "Bipolar", 
    "Schizophrenia", "OCD", "ADHD", "Autism", "Learning",
    "Relationship", "Couple", "Divorce", "Family", "Substance",
    "Alcohol", "PTSD", "Abuse", "Grief", "Phobias", "Dementia"
  ];

  // Filter counselors based on search and category
  const filteredCounselors = counselorsData.filter(counselor => {
    const matchesSearch = 
      counselor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      counselor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      counselor.treatmentTypes.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
      counselor.languages.some(l => l.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || 
      counselor.treatmentTypes.some(t => t.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Sort counselors
  const sortedCounselors = [...filteredCounselors].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'fee') return parseInt(a.fee.replace('₹', '')) - parseInt(b.fee.replace('₹', ''));
    if (sortBy === 'experience') return parseInt(b.experience) - parseInt(a.experience);
    return a.name.localeCompare(b.name);
  });

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<FontAwesome key={`star-${i}`} name="star" size={12} color="#fbbf24" />);
    }
    if (hasHalfStar) {
      stars.push(<FontAwesome key="half-star" name="star-half-full" size={12} color="#fbbf24" />);
    }
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<FontAwesome key={`empty-star-${i}`} name="star-o" size={12} color="#cbd5e1" />);
    }
    return stars;
  };

  const renderCounselorCard = ({ item }) => (
    <View style={styles.counselorCard}>
      {/* Card header with avatar and availability */}
      <View style={styles.cardHeader}>
        <View style={styles.counselorAvatar}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
        </View>
        <View style={styles.counselorBasic}>
          <Text style={styles.counselorName}>{item.name}</Text>
          <View style={styles.specializationBadge}>
            <Text style={styles.counselorSpecialization}>{item.specialization}</Text>
          </View>
        </View>
        <View style={[styles.availabilityBadge, item.availability === 'Now' && styles.availabilityNow]}>
          <Text style={[styles.availabilityText, item.availability === 'Now' && styles.availabilityNowText]}>
            {item.availability}
          </Text>
        </View>
      </View>

      {/* Tags (treatment types) */}
      <View style={styles.treatmentTags}>
        {item.treatmentTypes.slice(0, 3).map((t, i) => (
          <View key={i} style={styles.tag}>
            <Text style={styles.tagText}>{t}</Text>
          </View>
        ))}
        {item.treatmentTypes.length > 3 && (
          <View style={[styles.tag, styles.tagMore]}>
            <Text style={styles.tagText}>+{item.treatmentTypes.length - 3}</Text>
          </View>
        )}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Rating</Text>
          <View style={styles.statValueRow}>
            {renderStars(item.rating)}
            <Text style={styles.statValue}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Experience</Text>
          <Text style={styles.statValue}>{item.experience}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Patients</Text>
          <Text style={styles.statValue}>{item.patients.toLocaleString()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Fee</Text>
          <Text style={[styles.statValue, styles.feeValue]}>{item.fee}</Text>
        </View>
      </View>

      {/* Languages and action */}
      <View style={styles.cardFooter}>
        <View style={styles.languages}>
          {item.languages.map((lang, i) => (
            <View key={i} style={styles.language}>
              <Text style={styles.languageText}>{lang}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Book session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFilterChip = (treatment, index) => (
    <TouchableOpacity
      key={index}
      style={[styles.filterChip, selectedCategory === treatment && styles.filterChipActive]}
      onPress={() => setSelectedCategory(treatment)}
    >
      <Text style={[styles.filterChipText, selectedCategory === treatment && styles.filterChipTextActive]}>
        {treatment}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with decorative element */}
        <View style={styles.directoryHeader}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>🧠 Mental Health Experts</Text>
          </View>
          <Text style={styles.directoryTitle}>
            Find your <Text style={styles.titleHighlight}>counselor</Text>
          </Text>
          <Text style={styles.directorySubtitle}>
            Professional therapists specialized in various treatments
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={20} color="#8b9bb5" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, specialization, treatment or language..."
              placeholderTextColor="#9babc5"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm !== '' && (
              <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.searchClear}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter chips with horizontal scroll */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrapper}>
            <TouchableOpacity
              style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text style={[styles.filterChipText, selectedCategory === 'all' && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {allTreatments.slice(0, 12).map((treatment, idx) => renderFilterChip(treatment, idx))}
          </ScrollView>
        </View>

        {/* Sort bar and result count */}
        <View style={styles.sortBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortLeft}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'name' && styles.sortBtnActive]}
              onPress={() => setSortBy('name')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'name' && styles.sortBtnTextActive]}>Name</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'rating' && styles.sortBtnActive]}
              onPress={() => setSortBy('rating')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'rating' && styles.sortBtnTextActive]}>Rating</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'fee' && styles.sortBtnActive]}
              onPress={() => setSortBy('fee')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'fee' && styles.sortBtnTextActive]}>Fee (low)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'experience' && styles.sortBtnActive]}
              onPress={() => setSortBy('experience')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'experience' && styles.sortBtnTextActive]}>Experience</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={styles.resultCount}>
            <Text style={styles.resultCountText}>
              {sortedCounselors.length} {sortedCounselors.length === 1 ? 'counselor' : 'counselors'} found
            </Text>
          </View>
        </View>

        {/* Cards Grid */}
        <View style={styles.counselorGrid}>
          {sortedCounselors.length > 0 ? (
            <FlatList
              data={sortedCounselors}
              renderItem={renderCounselorCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.noResults}>
              <Ionicons name="search" size={80} color="#a0b3d9" />
              <Text style={styles.noResultsTitle}>No counselors found</Text>
              <Text style={styles.noResultsSubtitle}>Try adjusting your search or filter</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fcff',
  },
  // Header Styles
  directoryHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerBadge: {
    backgroundColor: '#e8edf9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 30,
    marginBottom: 12,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e6d',
    letterSpacing: 0.3,
  },
  directoryTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a2b4c',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleHighlight: {
    color: '#2563eb',
  },
  directorySubtitle: {
    fontSize: 14,
    color: '#5b6f8c',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 60,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    shadowColor: '#1c3454',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    padding: 0,
  },
  searchClear: {
    paddingHorizontal: 8,
  },
  searchClearText: {
    fontSize: 18,
    color: '#94a3b8',
  },
  // Filters Container
  filtersContainer: {
    marginBottom: 16,
  },
  chipsWrapper: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    backgroundColor: 'white',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1e3f76',
    borderColor: '#1e3f76',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3b4e6b',
  },
  filterChipTextActive: {
    color: 'white',
  },
  // Sort Bar
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 60,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#002040',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    color: '#62748e',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    backgroundColor: 'white',
  },
  sortBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3f5680',
  },
  sortBtnTextActive: {
    color: 'white',
  },
  resultCount: {
    backgroundColor: '#eef4fb',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 30,
  },
  resultCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4d627a',
  },
  // Counselor Grid
  counselorGrid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // Counselor Card
  counselorCard: {
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f0fe',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  counselorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#233b6e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#233b6e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  counselorBasic: {
    flex: 1,
  },
  counselorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14253d',
    marginBottom: 4,
  },
  specializationBadge: {
    backgroundColor: '#e9f0ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  counselorSpecialization: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
  },
  availabilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    backgroundColor: '#eef3fc',
    borderWidth: 1,
    borderColor: '#cfdff2',
  },
  availabilityNow: {
    backgroundColor: '#d2f0e0',
    borderColor: '#a0e0c0',
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34548c',
  },
  availabilityNowText: {
    color: '#0f6e4a',
  },
  // Treatment Tags
  treatmentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#f2f7ff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#d5e6ff',
  },
  tagMore: {
    backgroundColor: '#e2eaf9',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#264d7c',
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8fcfd',
    paddingVertical: 12,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2ecfe',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6c85a8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d3b61',
  },
  feeValue: {
    color: '#0b6b50',
  },
  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  languages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  language: {
    backgroundColor: '#ebf3ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#c8daff',
  },
  languageText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#3a5f8b',
  },
  bookBtn: {
    backgroundColor: '#1a3f6e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 40,
    shadowColor: '#0b1e33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  // No Results
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: 'white',
    borderRadius: 48,
    borderWidth: 1,
    borderColor: '#bdd3f0',
    borderStyle: 'dashed',
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f3b62',
    marginTop: 12,
    marginBottom: 4,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: '#6f8bb0',
  },
});

export default CounselorTable;