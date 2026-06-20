# 🔍 TRANSLATION DEBUG GUIDE

## Quick Checklist

### 1. Backend API Working?
```bash
curl -X POST https://ggr8bl1d-5001.inc1.devtunnels.ms/api/translate/text \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","to":"hi","from":"en"}'
```
✅ Should return: `{"translatedText":"नमस्कार"}`

### 2. App Console Check
```
When app opens, check for:
❌ [Error] useLanguageRender not found
❌ [Error] TranslatedMessageBubble not found  
❌ [Error] Translation API failed
❌ Cannot read property 'on' of undefined
```

### 3. Test Language Change
- Click 🌐 icon
- Select "हिन्दी (Hindi)"
- Check if:
  - Nav labels change to Hindi
  - Button text changes to Hindi
  - Messages change to Hindi

### 4. If NOTHING changes:
1. Check if app is using OLD build (clear app data & cache)
2. Verify rebuild happened:
   ```
   npx react-native clean-gradle-build
   npm run android
   ```
3. Check if useLanguageRender hook is being used:
   - Wallet shows Hindi "वॉलेट"
   - Appointment shows Hindi "नियुक्ति"
   - Messages show Hindi translations

### 5. If ONLY ChatBox works:
- This means useLanguageRender hook needs to be added to MORE screens
- Other screens still using old useTranslation

## Emergency Reset
```bash
cd C:/chatbot-app
rm -rf node_modules build android/.gradle
npm install
npm run android
```
