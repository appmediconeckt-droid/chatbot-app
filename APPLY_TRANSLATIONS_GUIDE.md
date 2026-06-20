# 🌍 APPLY TRANSLATIONS TO ALL SCREENS

## Quick Pattern (Copy-Paste)

Replace this:
```jsx
<Text style={styles.label}>{t('key:value')}</Text>
```

With this:
```jsx
<AutoTranslatedText style={styles.label}>{t('key:value')}</AutoTranslatedText>
```

## Screens to Update (Priority Order)

### User Side:
1. ✅ WalletDashboard.jsx - DONE
2. ⬜ BookAppointment.jsx - Add import + use AutoTranslatedText for labels
3. ⬜ CounselorDirectory.jsx - Use for ratings, experience, etc.
4. ⬜ PatientProfile.jsx - Use for form labels
5. ⬜ UserAccountSettings.jsx - Use for all settings labels
6. ⬜ HelpSupport.jsx - Use for help text
7. ⬜ PrivacyPolicy.jsx - Use for policy text

### Counselor Side:
8. ⬜ Messagesou.jsx - Use for message labels
9. ⬜ Dashboardcou.jsx - Use for dashboard labels
10. ⬜ PatientRequests.jsx - Use for request labels
11. ⬜ CounselorProfile.jsx - Use for profile labels
12. ⬜ CounselorSettings.jsx - Use for settings labels

## Import Statement (All Files):
```jsx
import AutoTranslatedText from '../../path/to/AutoTranslatedText';
```

## Example: Complete BookAppointment.jsx Update
```jsx
// At top:
import AutoTranslatedText from '../../../../../../components/AutoTranslatedText';

// In JSX, replace all t() with AutoTranslatedText:
BEFORE: <Text style={styles.title}>{t('appointment:counselorDirectory')}</Text>
AFTER:  <AutoTranslatedText style={styles.title}>{t('appointment:counselorDirectory')}</AutoTranslatedText>
```

## Result:
✅ All screens will translate ALL text dynamically via Azure API
✅ Works exactly like the web app
✅ No need to manually translate JSON files
✅ Real-time translation on language switch
