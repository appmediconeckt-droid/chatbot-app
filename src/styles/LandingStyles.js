import { StyleSheet, Dimensions } from 'react-native';
import { Colors, Spacing, Typography } from './globalStyles';

const { width, height } = Dimensions.get('window');

const isSmall = width < 380;
const isMedium = width >= 380 && width < 768;
const isLarge = width >= 768;

export default StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    height: 70,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  headerScrolled: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    ...Typography.h3,
    color: Colors.white,
  },
  logoTextScrolled: {
    color: Colors.primary,
  },
  logoHighlight: {
    color: Colors.accent,
  },
  hero: {
    paddingTop: 100,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 40,
  },
  heroContent: {
    paddingHorizontal: Spacing.lg,
    alignItems: isLarge ? 'flex-start' : 'center',
  },
  heroTitle: {
    ...Typography.h1,
    color: Colors.white,
    textAlign: isLarge ? 'left' : 'center',
    marginBottom: Spacing.md,
  },
  heroDescription: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: isLarge ? 'left' : 'center',
    marginBottom: Spacing.lg,
  },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
    justifyContent: isLarge ? 'flex-start' : 'center',
  },
  btn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.secondary,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: Colors.white,
  },
  btnText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.white,
  },
  section: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    ...Typography.bodySmall,
    textAlign: 'center',
    maxWidth: 600,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  doctorCard: {
    width: isLarge ? (width - 64) / 3 : width - 32,
    marginRight: isLarge ? Spacing.md : 0,
  },
  footer: {
    backgroundColor: Colors.primaryDark,
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  // Add more styles as needed...
});
