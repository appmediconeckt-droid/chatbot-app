# Multi-Language Implementation Guide

## Overview
The app now supports **18 languages** organized in 3 tiers:

### Priority Languages (2)
1. **English (en)** - Default language
2. **Hindi (hi)** - Widely spoken in India

### World Languages (8)
3. **Chinese (zh)** - Mandarin (Simplified)
4. **Spanish (es)** - Spain & Latin America
5. **French (fr)** - France & Africa
6. **Arabic (ar)** - Standard Arabic
7. **Portuguese (pt)** - Portugal & Brazil
8. **Russian (ru)** - Russia & Eastern Europe
9. **Japanese (ja)** - Japan
10. **German (de)** - Germany & Central Europe

### Indian Languages (8)
11. **Tamil (ta)**
12. **Telugu (te)**
13. **Kannada (kn)**
14. **Malayalam (ml)**
15. **Bengali (bn)**
16. **Gujarati (gu)**
17. **Marathi (mr)**
18. **Urdu (ur)** - Pakistan & India
19. **Punjabi (pa)** - Punjab

## Architecture

### Web App (c:/chatbot)
- **Location**: `src/i18n/`
- **Files**:
  - `LanguageContext.jsx` - React context for language management
  - `translations.js` - All language translations (flat structure)
- **Fallback**: English if translation key missing
- **User preference**: Stored in localStorage
- **Separate preferences**: User and Counselor can have different languages

### React Native App (c:/chatbot-app)
- **Location**: `src/i18n/`
- **Structure**: i18next with namespace-based JSON files
- **Files**:
  - `index.js` - i18next configuration
  - `locales/` - JSON files per language
- **Namespaces**: common, auth, dashboard, counselor, messages, settings, lock, language, call, profile, wallet, appointment
- **Fallback**: English if translation missing
- **User preference**: Stored in AsyncStorage with user/role specific keys

## Translation Status

### Completed
✅ English - Complete (all strings)
✅ Hindi - Complete (all strings)
✅ Chinese (Mandarin) - Complete (critical strings + common)
✅ Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Marathi, Urdu, Punjabi - Complete

### In Progress / Needs Translation
The following languages have template structure and fall back to English for missing keys:
- Spanish (es) - Needs translation
- French (fr) - Needs translation
- Arabic (ar) - Needs translation
- Portuguese (pt) - Needs translation
- Russian (ru) - Needs translation
- Japanese (ja) - Needs translation
- German (de) - Needs translation

## How to Complete Translations

### For Web App (translations.js)
```javascript
export const translations = {
  es: {  // Spanish example
    loading: "Cargando...",
    save: "Guardar",
    // ... more keys
  }
}
```

### For React Native (locales/XX.json)
```json
{
  "common": {
    "loading": "...",
    "error": "...",
    // ... more keys
  },
  "auth": {
    // ...
  }
  // ... other namespaces
}
```

## Translation Priority

### Phase 1: Critical Strings (Required)
- Common UI elements (loading, save, cancel, submit, etc.)
- Authentication (login, signup, password, etc.)
- Dashboard (chat, appointments, counselor, etc.)
- Errors and validation messages

### Phase 2: Important Strings (High)
- Messages (chat, typing, notifications)
- Settings (profile, security, language)
- Counselor specific (sessions, earnings, availability)

### Phase 3: Additional Strings (Nice to have)
- Help text
- Labels and descriptions
- Detailed explanations

## Key Features Implemented

✅ **User-specific Language Preference**
- Different languages for users and counselors
- Persistent storage (localStorage for web, AsyncStorage for mobile)

✅ **Language Selection UI**
- Languages grouped by region
- Native language names displayed
- Easy switching between languages

✅ **AI Chat Support**
- Backend receives language preference
- Responses generated in selected language

✅ **Counselor Support**
- Counselor can speak multiple languages
- Each counselor can set their preferred language
- Language preference stored separately for counselor role

✅ **Graceful Fallback**
- Missing translations automatically fall back to English
- App remains functional even with incomplete translations
- No breaking errors on missing keys

## How to Test

### Web App
1. Open settings/language selector
2. Switch between different languages
3. Verify UI updates correctly
4. Check both user and counselor sides

### React Native
1. Go to Settings → Language
2. Select different language
3. Restart app to see changes applied
4. Check if AsyncStorage persists preference

## Future Enhancements

1. **Auto-translation Service**
   - Integrate Google Translate API for auto-completion
   - Cache translations to avoid repeated API calls

2. **Community Translations**
   - Allow users to contribute translations
   - Crowdsource missing translations

3. **Language Detection**
   - Auto-detect device language
   - Set default language based on device settings

4. **RTL Language Support**
   - Implement right-to-left layout for Arabic/Urdu
   - Flip UI components as needed

5. **Professional Translation**
   - Hire professional translators for critical languages
   - Ensure medical/counseling terminology is accurate

## Notes

- Always test thoroughly when adding new languages
- Ensure medical and counseling terminology is accurate
- Consider cultural nuances in translations
- Keep translation keys consistent across web and mobile
- Document any language-specific UI changes
