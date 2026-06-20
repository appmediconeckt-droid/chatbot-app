# ⚡ Quick Fix: 404 Counselor Not Found + Swipe Back

## The 2 Issues

### Issue 1: 404 Error When Submitting Rating
```
User tries to rate → Click Submit → Error: 404 - Counselor not found
```

### Issue 2: Swipe Back Not Showing Rating Popup  
```
User swipes back to leave chat → No rating popup appears
```

---

## Quick Diagnosis (5 minutes)

### Step 1: Build the App
```bash
cd /chatbot-app
# Build with the latest changes
```

### Step 2: Open Chat & Try Rating
1. Open any chat
2. Try to go back (tap button)
3. Rating popup appears?
   - ✅ YES → Go to Step 3
   - ❌ NO → Issue with popup flow

### Step 3: Check Console for Counselor ID
Open console (Xcode/Android Studio) and look for:

```
✅ resolveCounselorId resolved to: 507f1f77bcf86cd799439011
```

If you see:
```
❌ resolveCounselorId: No counselor ID found!
```

Then counselor ID is missing. Check where currentCounselor comes from.

### Step 4: Try Rating Submission
1. Rating popup shows
2. Select 4 stars
3. Click "Submit rating"
4. Check console for logs:

```
📤 submitRating: Sending to backend
   counselorId: 507f...
```

**If you see error:**
```
❌ Rating submission failed!
   HTTP Status: 404
   Error Message: Counselor not found
```

Then follow "Fix 404 Issue" below.

---

## Fix 404 Issue

### Root Cause
Counselor doesn't exist in database OR has wrong role

### Quick Fix Steps

**Step 1: Get the Counselor ID**
From console log, copy the ID shown in:
```
counselorId: 507f1f77bcf86cd799439011
```

**Step 2: Check Database**
```bash
# Connect to your MongoDB and run:
db.users.findOne({
  _id: ObjectId("507f1f77bcf86cd799439011"),
  role: "counsellor"  # ← Important: "counsellor" with 2 L's!
})

# If this returns NULL → Counselor doesn't exist or wrong role
# If this returns document → Counselor exists, check rating API
```

**Step 3: Verify Counselor Role**
The counselor must have role exactly: `"counsellor"` (British spelling, 2 L's)

If role is `"counselor"` (1 L) or `"Counsellor"` (capital), fix it:
```bash
db.users.updateOne(
  {_id: ObjectId("...")},
  {$set: {role: "counsellor"}}
)
```

**Step 4: Test API Directly**
```bash
curl -X POST \
  https://chatbot-backend-production-ea76.up.railway.app/api/counselors/507f1f77bcf86cd799439011/ratings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stars": 4, "comment": "test"}'

# Should return: {rating: X.X, ratingCount: Y}
# If 404 → Counselor doesn't exist
# If 403 → Wrong user role
# If 401 → No token
```

---

## Fix Swipe Back Issue

### Root Cause
Swipe gesture not properly triggering rating popup

### Quick Fix Steps

**Step 1: Verify Backend Logs**
```
App console should show:
📱 beforeRemove listener triggered - action: GoBack
```

If you DON'T see this when you swipe:
- Listener might not be registered
- Swipe might be firing different event

**Step 2: Test Visible Back Button First**
```
1. Open chat
2. TAP visible back arrow (not swipe)
3. Rating popup appears?
   ✅ YES → Then swipe should work too
   ❌ NO → Issue is not swipe-specific
```

**Step 3: Check Pending Rating is Saved**
In console, run:
```javascript
AsyncStorage.getItem('@pending_ratings').then(r => console.log(JSON.parse(r)));
```

Should show:
```
[
  {
    chatId: "chat_1718...",
    counselorId: "507f...",
    counselorName: "Dr. Smith",
    ...
  }
]
```

If empty → savePendingRating() not called on mount

**Step 4: Test Swipe & Check Logs**
```
1. Swipe from left edge
2. Look for console logs:
   📱 beforeRemove listener triggered
   🔍 Checking if rating needed...
   🛑 Preventing navigation - showing rating popup
   
   If you see these → Swipe working correctly
   If no logs → Listener not being called
```

---

## What Was Fixed

### Code Changes:
1. ✅ Better counselor ID resolution + logging (Line 292)
2. ✅ Enhanced beforeRemove listener + logging (Line 558)
3. ✅ Improved submitRating validation (ratingService.js)

### What They Do:
- Log where counselor ID comes from
- Log when swipe/back fires
- Validate counselor ID before API call
- Better error messages

---

## Test Checklist

After implementing fixes:

- [ ] Open chat successfully
- [ ] Counselor ID is logged: `✅ resolveCounselorId resolved to: ...`
- [ ] Tap back → Rating popup appears
- [ ] Swipe back → beforeRemove listener logs show
- [ ] Swipe back → Rating popup appears
- [ ] Rating popup → Select stars, submit
- [ ] No 404 error in response
- [ ] "Thank you!" alert appears
- [ ] Auto-navigates back
- [ ] Open same counselor → No popup (already rated)

---

## If Still Getting 404

Share with me:

1. **Counselor ID from logs:**
   ```
   counselorId: [COPY FROM LOG]
   ```

2. **Database check result:**
   ```bash
   db.users.findOne({_id: ObjectId("...")})
   # Copy the result or "null" if not found
   ```

3. **Counselor role:**
   ```
   Is it "counsellor" with 2 L's?
   ```

4. **Full error from console:**
   ```
   [COPY ERROR MESSAGE]
   ```

Then I can provide exact fix! 🔧

---

## If Swipe Not Working

Share:

1. **Console logs when you swipe:**
   ```
   [DO YOU SEE "beforeRemove listener triggered"?]
   ```

2. **Test result with back button:**
   ```
   ✅ Back button works OR ❌ Back button doesn't work
   ```

3. **AsyncStorage pending ratings:**
   ```bash
   AsyncStorage.getItem('@pending_ratings').then(r => console.log(JSON.parse(r)));
   # [COPY RESULT]
   ```

Then I can debug swipe issue! 📱

---

## Status: ✅ Ready to Test

All diagnostic code is in place. Follow the steps above to:
1. Identify if it's 404 (counselor not found) or swipe (navigation not prevented)
2. Gather console logs
3. Check database state
4. Share results for exact fix

Let's get this working! 🚀
