# 🌍 QUICK FIX: Make All Screens Translate

## Problem
- ChatBox works ✅
- Other screens don't change when language switches

## Solution
Screens already have `useTranslation()` BUT they need to use `t()` for ALL hardcoded text.

## For ANY Screen - Apply This Pattern:

### ✅ CORRECT (Uses translations):
```jsx
import { useTranslation } from 'react-i18next';

const MyScreen = () => {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text>{t('wallet:walletOverview')}</Text>
      <Text>{t('common:loading')}</Text>
    </View>
  );
};
```

### ❌ WRONG (Hardcoded):
```jsx
<Text>Wallet Overview</Text>  // ❌ Won't translate
<Text>Loading...</Text>        // ❌ Won't translate
```

---

## 📋 SCREENS TO UPDATE (Use Pattern Above):

### User Side:
- [x] ChatBox.jsx - ✅ DONE
- [ ] UserDashboard.jsx - Replace all hardcoded text with t()
- [ ] WalletDashboard.jsx - Mostly done, check for missed strings
- [ ] BookAppointment.jsx - Replace hardcoded buttons/labels
- [ ] PatientProfile.jsx - Replace form labels
- [ ] CounselorDirectory.jsx - Replace search/filter text
- [ ] HelpSupport.jsx - Replace help text
- [ ] PrivacyPolicy.jsx - Replace policy text
- [ ] UserAccountSettings.jsx - Replace settings labels
- [ ] Wallet.jsx - Replace labels

### Counselor Side:
- [x] Messagesou.jsx - ✅ DONE
- [ ] Dashboardcou.jsx - Replace dashboard labels
- [ ] CounselorProfile.jsx - Replace profile text
- [ ] PatientRequests.jsx - Replace request labels
- [ ] CounselorSettings.jsx - Replace settings text
- [ ] SMSInput.jsx - Replace input labels

---

## 🚀 QUICK FIND & REPLACE:

In any screen, search for hardcoded strings and replace:

**Example:**
```
FIND: <Text>Welcome</Text>
REPLACE: <Text>{t('dashboard:welcome')}</Text>
```

---

## ✨ Available Translation Keys:

Use these namespaces in `t()` calls:
- `auth:` - Login, signup, password
- `common:` - Loading, cancel, save, ok, etc.
- `dashboard:` - Welcome, dashboard, chat
- `wallet:` - Wallet labels
- `appointment:` - Booking, counselor
- `messages:` - Chat, messages
- `settings:` - Profile, account
- `profile:` - Personal details
- `counselor:` - Counselor-specific

---

## 🧪 TESTING CHECKLIST:

After updates:
1. Open app → Go to ChatBox
2. Click 🌐 → Select Hindi
3. Open each tab (Wallet, Appointment, etc.)
4. ✅ All text should change to Hindi
5. Switch back to English → All changes back
6. Same for Counselor side

---

## 💡 RULE:
**If text should appear in the UI, it should be inside `t()` function**

Any hardcoded text = won't translate
Any text in `t()` = will auto-translate
