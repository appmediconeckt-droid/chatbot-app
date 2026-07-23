# 🧪 Complete Testing Guide - ChatBot App

## 📋 Test Credentials

### User Account
- **Email:** vijaybadoria21gmail.com
- **Password:** 123456

### Counselor Account
- **Email:** vivekraj211202cst@sdbc.ac.in
- **Password:** 123456

---

## 👤 PART 1: USER SIDE TESTING

### 1️⃣ Authentication & Login
- [ ] Login with correct credentials → Should succeed
- [ ] Login with wrong password → Should show error
- [ ] Login with invalid email → Should show error
- [ ] Check if session persists after app restart
- [ ] Logout → Should return to login screen
- [ ] Check "Remember Me" functionality if present

### 2️⃣ User Dashboard
- [ ] Dashboard loads without errors
- [ ] User avatar/profile picture displays correctly
- [ ] User name displays correctly
- [ ] Online/offline status shows correctly
- [ ] Check dashboard stats (if any)
- [ ] All navigation tabs are accessible
- [ ] No lag or performance issues

### 3️⃣ Profile Management
- [ ] **View Profile:**
  - [ ] All profile fields display correctly
  - [ ] Profile picture shows
  - [ ] Personal details visible (name, age, gender, etc.)
  - [ ] Medical history displays
  - [ ] Location shows SPLIT by comma (Bangalore, Pune format)
  - [ ] Language changes → Location translates

- [ ] **Edit Profile:**
  - [ ] Can edit personal details
  - [ ] Can update profile picture
  - [ ] Changes save successfully
  - [ ] Can edit medical history
  - [ ] Can update location
  - [ ] Save button works
  - [ ] Success message appears after save

### 4️⃣ Language Support (🌐 Language Selector)
- [ ] Click globe icon → Language popup appears
- [ ] Search for language works
- [ ] Select different language → Entire app translates
- [ ] Profile content translates:
  - [ ] Labels translate (Name, Age, Gender, etc.)
  - [ ] About/Bio field translates automatically
  - [ ] Location translates (Bangalore → बेंगलुरु)
- [ ] Language persists after app restart
- [ ] All 80+ languages available
- [ ] Switching back to English works

### 5️⃣ Chat with Counselor
- [ ] **Chat List:**
  - [ ] List of counselors loads
  - [ ] Search bar works
  - [ ] Language change → Refreshes properly
  - [ ] Can see last message
  - [ ] Unread count shows
  - [ ] Online status indicator works

- [ ] **Chat Screen:**
  - [ ] Messages load without errors
  - [ ] Message text displays properly
  - [ ] Timestamps show correctly
  - [ ] Message status shows (sending, sent, read)
  - [ ] Can type and send messages
  - [ ] Sent messages appear in chat
  - [ ] Message translates when language changes
  - [ ] Can attach files
  - [ ] Can see file attachments

- [ ] **Message Features:**
  - [ ] Delete message option available
  - [ ] Can delete own messages
  - [ ] Deleted messages disappear
  - [ ] Can reply/forward (if supported)
  - [ ] Emoji support works

### 6️⃣ Chat Details Modal
- [ ] Click 3-dot menu → Options appear
- [ ] **Chat Details** option visible
- [ ] Click "Chat Details" → Modal opens
- [ ] Profile section shows:
  - [ ] Counselor name displays
  - [ ] Avatar/avatar initial shows
  - [ ] Online status shows
- [ ] Stats show correctly:
  - [ ] Total messages count
  - [ ] Video calls count
  - [ ] Voice calls count
- [ ] Media section (if have shared media):
  - [ ] Shows grid of photos/videos
  - [ ] Can count media items
- [ ] Documents section (if have shared docs):
  - [ ] Lists shared documents
  - [ ] Shows file names
- [ ] Links section (if have shared links):
  - [ ] Shows shared URLs
  - [ ] URLs are clickable

### 7️⃣ Message Options Menu
- [ ] Click 3-dot menu → Menu appears with options:
  - [ ] ✅ Chat Details
  - [ ] ✅ Refresh Messages
  - [ ] ✅ Delete Chat
  - [ ] ❌ (Report Issue & Chat Details removed)

- [ ] **Refresh Messages:**
  - [ ] Click → Refreshes chat
  - [ ] Fetches latest messages
  - [ ] No errors on refresh
  - [ ] Menu closes after action

- [ ] **Delete Chat:**
  - [ ] Click → Confirmation appears
  - [ ] Confirm deletion → Chat deleted
  - [ ] Chat disappears from list
  - [ ] Cannot recover deleted chat

### 8️⃣ Video & Voice Calls
- [ ] **Video Call:**
  - [ ] Can initiate video call
  - [ ] Call connects properly
  - [ ] Video displays on both ends
  - [ ] Can end call
  - [ ] Call history updates

- [ ] **Voice Call:**
  - [ ] Can initiate voice call
  - [ ] Audio works both directions
  - [ ] Can end call
  - [ ] Call history updates

### 9️⃣ Notifications & Alerts
- [ ] New message notifications appear
- [ ] Notification badge shows count
- [ ] Click notification → Opens chat
- [ ] Notifications clear after viewing
- [ ] Sound works (if enabled)

### 🔟 Settings & Preferences
- [ ] Can access settings
- [ ] Language selection works
- [ ] Changes persist
- [ ] Can view privacy policy
- [ ] Can view terms of service
- [ ] Logout functionality works

---

## 👨‍⚕️ PART 2: COUNSELOR SIDE TESTING

### 1️⃣ Authentication & Login
- [ ] Login with counselor credentials → Success
- [ ] Login with wrong password → Error
- [ ] Session persists on restart
- [ ] Logout → Return to login

### 2️⃣ Counselor Dashboard
- [ ] Dashboard loads
- [ ] Profile section shows
- [ ] Statistics display (if any)
- [ ] Navigation works
- [ ] No errors or crashes

### 3️⃣ Profile Management
- [ ] **View Profile:**
  - [ ] All fields visible
  - [ ] Profile picture displays
  - [ ] About/Bio shows
  - [ ] Specializations visible
  - [ ] Experience displays
  - [ ] Location shows SPLIT (Bangalore, Pune)
  - [ ] Languages offered visible
  - [ ] Certifications/Qualifications display
  - [ ] Rating shows (if applicable)

- [ ] **Edit Profile:**
  - [ ] Can edit all fields
  - [ ] Can update profile picture
  - [ ] Can edit about/bio
  - [ ] Can add specializations
  - [ ] Can update location with comma format
  - [ ] Can upload certifications
  - [ ] Changes save successfully
  - [ ] Success notification appears

### 4️⃣ Language Support
- [ ] Language selector works (🌐)
- [ ] Profile labels translate
- [ ] About field translates when language changes
- [ ] Location translates (Bangalore → बेंगलुरु)
- [ ] All 80+ languages available
- [ ] Language persists on restart

### 5️⃣ Patient Requests / Appointments
- [ ] **Requests List:**
  - [ ] Pending requests show
  - [ ] Accepted requests show
  - [ ] Cancelled requests show
  - [ ] Can filter by status
  - [ ] Patient names display
  - [ ] Request dates show

- [ ] **Accept Request:**
  - [ ] Can click "Accept Request"
  - [ ] Request status changes to "Accepted"
  - [ ] Appointment action buttons appear (Video, Voice, Chat)

- [ ] **Appointment Actions:**
  - [ ] 🎥 **Video Call Button:**
    - [ ] Shows blue circle icon
    - [ ] Can click
    - [ ] Shows confirmation dialog
    - [ ] Can start call
  
  - [ ] 📞 **Voice Call Button:**
    - [ ] Shows green circle icon
    - [ ] Can click
    - [ ] Shows confirmation dialog
    - [ ] Can start call
  
  - [ ] 💬 **Chat Button:**
    - [ ] Shows amber circle icon
    - [ ] Can click
    - [ ] Shows confirmation dialog
    - [ ] Can open chat

- [ ] **Action Button Layout:**
  - [ ] All 3 buttons same size
  - [ ] Icons display correctly
  - [ ] Text labels visible (Video, Voice, Chat)
  - [ ] Professional appearance
  - [ ] Proper spacing between buttons

### 6️⃣ Chat with Patients
- [ ] **Messages List:**
  - [ ] Patient list loads
  - [ ] Search works
  - [ ] Can filter messages
  - [ ] Language change works
  - [ ] Last message shows
  - [ ] Online status visible

- [ ] **Chat Screen:**
  - [ ] Messages load
  - [ ] Can read patient messages
  - [ ] Can type replies
  - [ ] Can send messages
  - [ ] Timestamp shows correctly
  - [ ] Message status shows (sending, sent)
  - [ ] Can attach files
  - [ ] Language changes → Messages translate

- [ ] **Header (Chat Screen):**
  - [ ] Patient name shows
  - [ ] Patient avatar shows
  - [ ] Online status shows
  - [ ] Voice call button works
  - [ ] Video call button works
  - [ ] 3-dot menu works

### 7️⃣ Chat Options Menu
- [ ] Click 3-dot menu → Options visible:
  - [ ] ✅ Chat Details
  - [ ] ✅ Refresh Messages
  - [ ] ✅ Clear Chat
  - [ ] ❌ (Report Issue & Chat Details removed)

- [ ] **Chat Details Modal:**
  - [ ] Patient info shows
  - [ ] Avatar displays
  - [ ] Online status shows
  - [ ] Message count shows
  - [ ] Call counts show (video, voice)
  - [ ] Media gallery shows (if any)
  - [ ] Documents list shows (if any)
  - [ ] Links list shows (if any)
  - [ ] Can close modal

- [ ] **Refresh Messages:**
  - [ ] Fetches latest messages
  - [ ] No errors
  - [ ] Menu closes

- [ ] **Clear Chat:**
  - [ ] Shows confirmation
  - [ ] Can confirm
  - [ ] Chat clears
  - [ ] All messages deleted

### 8️⃣ Messages Screen / Chat List
- [ ] **Header:**
  - [ ] "Messages" title shows
  - [ ] 3-dot menu visible
  - [ ] Search bar present
  - [ ] Search icon visible (professional Ionicons)
  - [ ] Clear button works (X icon)

- [ ] **Search:**
  - [ ] Can type in search
  - [ ] Results filter correctly
  - [ ] Can clear search
  - [ ] Placeholder text clear: "Search messages..."

- [ ] **Options Menu:**
  - [ ] Click 3-dot → Menu appears
  - [ ] Only shows "Refresh Messages"
  - [ ] Click refresh → Updates list
  - [ ] No errors

### 9️⃣ Message Spacing
- [ ] **Header to Search Bar:**
  - [ ] No excessive gap
  - [ ] marginTop: -30 applied
  - [ ] Professional spacing

- [ ] **Message Alignment:**
  - [ ] Message text and timestamp on same line
  - [ ] Timestamp at bottom right
  - [ ] Not above message text
  - [ ] Proper row layout (flexDirection: 'row')

### 🔟 Settings
- [ ] Language selector works
- [ ] Profile settings accessible
- [ ] Can update preferences
- [ ] Logout works

---

## 🐛 Common Bugs to Check

### Critical Issues
- [ ] App crashes on launch
- [ ] Login fails
- [ ] Messages don't send
- [ ] Calls don't work
- [ ] Profile won't load

### High Priority
- [ ] Language not translating
- [ ] Location not splitting properly
- [ ] Message timestamps wrong
- [ ] Chat details not opening
- [ ] Profile photo not showing

### Medium Priority
- [ ] UI spacing issues
- [ ] Button alignment off
- [ ] Icons not displaying
- [ ] Animations laggy
- [ ] Search not working

### Low Priority
- [ ] Font size inconsistent
- [ ] Colors slightly off
- [ ] Spacing could be tighter
- [ ] Minor UI tweaks

---

## 📊 Testing Report Template

When you find a bug, report it with:

```
### Bug #[Number]
**Severity:** Critical / High / Medium / Low

**Screen/Feature:** [Where it happens]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:** [What should happen]

**Actual Result:** [What actually happens]

**Screenshots:** [Attach if possible]

**Device:** [iPhone/Android, version]

**Account:** [User/Counselor, email if relevant]
```

---

## ✅ Testing Checklist Summary

### User Side
- [ ] Authentication
- [ ] Dashboard
- [ ] Profile (view & edit)
- [ ] Language support
- [ ] Chat with counselor
- [ ] Chat details modal
- [ ] Message options
- [ ] Video/Voice calls
- [ ] Notifications

### Counselor Side
- [ ] Authentication
- [ ] Dashboard
- [ ] Profile (view & edit)
- [ ] Language support
- [ ] Patient requests
- [ ] Appointment actions
- [ ] Chat with patients
- [ ] Chat details modal
- [ ] Message spacing & layout
- [ ] Options menu

---

## 🚀 Start Testing!

1. **Install and run the app** on your device/emulator
2. **Start with User Side** - complete all steps
3. **Report bugs** using the template above
4. **Then test Counselor Side** - complete all steps
5. **Report all bugs** found
6. **I'll fix them immediately** ✨

---

**Created:** 2026-07-04
**Last Updated:** During comprehensive testing phase
