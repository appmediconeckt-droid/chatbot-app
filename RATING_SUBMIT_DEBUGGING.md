# 🔧 Rating Submission - Debugging Guide

## Common Issues & Fixes

### ❌ Issue 1: 403 Forbidden Error
**Error Message:** `Error: 403 - Only users can rate counselors`

**Cause:** User role is not "user"

**Fix:**
1. Check AsyncStorage for user role:
   ```javascript
   // In browser/Xcode console:
   AsyncStorage.getItem('userRole').then(role => console.log("Role:", role));
   ```
2. Must be exactly `"user"` (lowercase)
3. Check your login process - ensure user is stored with correct role

**Backend Check:**
```javascript
// In ratingController.js line 35
if (req.user.role !== "user") {
  return res.status(403).json({ error: "Only users can rate counselors" });
}
```

---

### ❌ Issue 2: 404 Counselor Not Found
**Error Message:** `Error: 404 - Counselor not found`

**Cause:** Counselor ID doesn't exist or is in wrong format

**Fix:**
1. Check counselor ID is valid MongoDB ObjectId:
   ```javascript
   // Should look like: "507f1f77bcf86cd799439011"
   // NOT like: "Counselor A" or "undefined"
   ```
2. Verify counselor exists in database:
   ```bash
   # In MongoDB
   db.users.findOne({_id: ObjectId("...")})
   ```
3. Check counselor role is `"counsellor"` (British spelling with 2 L's):
   ```bash
   db.users.findOne({_id: ObjectId("..."), role: "counsellor"})
   ```

**Backend Check:**
```javascript
// In ratingController.js lines 51-57
const counselor = await User.findOne({
  _id: counselorId,
  role: "counsellor",  // ← Note: "counsellor" not "counselor"
});
if (!counselor) {
  return res.status(404).json({ error: "Counselor not found" });
}
```

---

### ❌ Issue 3: 400 Bad Request - Invalid Counselor ID
**Error Message:** `Error: 400 - Invalid counselor id`

**Cause:** Counselor ID is not a valid MongoDB ObjectId

**Fix:**
1. Check what's being passed:
   ```javascript
   // Add logging in ChatBox.jsx:
   console.log("DEBUG: counselorId type:", typeof ratingTarget.counselorId);
   console.log("DEBUG: counselorId value:", ratingTarget.counselorId);
   ```
2. Should be string of 24 hex characters
3. Should NOT be object like `{_id: "..."}` or null/undefined

**Backend Check:**
```javascript
// In ratingController.js line 42
if (!mongoose.Types.ObjectId.isValid(counselorId)) {
  return res.status(400).json({ error: "Invalid counselor id" });
}
```

---

### ❌ Issue 4: 400 Bad Request - Invalid Stars
**Error Message:** `Error: 400 - stars must be between 1 and 5`

**Cause:** Stars value is invalid

**Fix:**
1. Verify stars is a number 1-5
2. Check in ratingService.js line 32:
   ```javascript
   if (!stars || stars < 1 || stars > 5) throw new Error("stars must be 1-5");
   ```

---

### ❌ Issue 5: 401 Unauthorized
**Error Message:** `Error: 401 - Unauthorized`

**Cause:** No valid token in request

**Fix:**
1. Check if token is stored:
   ```javascript
   AsyncStorage.getItem('accessToken').then(token => 
     console.log("Token:", token ? "Present" : "Missing")
   );
   ```
2. Check if token is still valid (not expired)
3. Check axiosConfig line 19-36 - request interceptor adds token:
   ```javascript
   const token = 
     (await AsyncStorage.getItem('accessToken')) ||
     (await AsyncStorage.getItem('token'));
   if (token) {
     config.headers.Authorization = `Bearer ${token}`;
   }
   ```

---

### ❌ Issue 6: Network Error
**Error Message:** `Network Error` or timeout

**Cause:** Backend unreachable

**Fix:**
1. Check API_BASE_URL in axiosConfig.js line 6:
   ```javascript
   export const API_BASE_URL = 'https://chatbot-backend-production-ea76.up.railway.app';
   ```
2. Verify backend is running:
   ```bash
   curl https://chatbot-backend-production-ea76.up.railway.app/api/health
   ```
3. Check internet connection on device
4. Check firewall/CORS settings

---

## Step-by-Step Debugging

### Step 1: Enable Detailed Logging
The code now has detailed logging. Check console for these messages:

```
DEBUG: submitRating called with: {counselorId: "...", stars: 4, chatId: "..."}
DEBUG: Rating submitted successfully: {rating: 4.5, ratingCount: 12}
```

Or if failed:

```
DEBUG: Rating submission failed!
Error status: 403
Error data: {error: "Only users can rate counselors"}
Error message: Request failed with status code 403
```

### Step 2: Check What's Being Sent
Look for the first debug log:
```
DEBUG: submitRating called with: {counselorId: "507f...", stars: 4, chatId: "chat_123"}
```

Verify:
- ✅ counselorId is a string of 24 hex chars
- ✅ stars is 1-5
- ✅ chatId exists

### Step 3: Check Error Status Code
```
Error status: XXX
```

- `400` → Bad request data (check counselorId, stars format)
- `401` → No token (check AsyncStorage)
- `403` → Wrong role (check user role is "user")
- `404` → Counselor not found (check counselor exists)
- `500` → Server error (check backend logs)

### Step 4: Check Error Data
```
Error data: {error: "..."}
```

This message tells you exactly what went wrong.

---

## Testing Checklist

- [ ] **User Role Check**
  ```javascript
  AsyncStorage.getItem('userRole').then(r => console.log('Role:', r));
  // Should print: Role: user
  ```

- [ ] **Counselor ID Check**
  ```javascript
  // In ChatBox where rating popup shows
  console.log('Counselor ID:', ratingTarget.counselorId);
  // Should be 24-char hex string like "507f1f77bcf86cd799439011"
  ```

- [ ] **Token Check**
  ```javascript
  AsyncStorage.getItem('accessToken').then(t => console.log('Token:', t?.slice(0,20)));
  // Should print token, not null/undefined
  ```

- [ ] **Backend Running**
  ```bash
  # From terminal
  curl https://chatbot-backend-production-ea76.up.railway.app/api/auth/me -H "Authorization: Bearer YOUR_TOKEN"
  ```

- [ ] **Rating Submit Flow**
  1. Open chat
  2. Try to go back → rating popup shows
  3. Enter 4 stars
  4. Check console for debug logs
  5. Click submit
  6. Look for error in console or alert

---

## Information to Provide

When asking for help, provide:

1. **Full error message** from the alert:
   ```
   Error: 403 - Only users can rate counselors
   ```

2. **Console logs** showing:
   ```
   DEBUG: submitRating called with: {...}
   DEBUG: Rating submission failed!
   Error status: 403
   Error data: {error: "..."}
   ```

3. **User details**:
   - What role do you have? (check AsyncStorage)
   - What's your user ID?
   - What's the counselor ID?

4. **When does it fail?**
   - Right when you tap submit?
   - After loading spinner?
   - Network timeout?

---

## Common Successful Flow

```
DEBUG: submitRating called with: {
  counselorId: "507f1f77bcf86cd799439011", 
  stars: 4, 
  chatId: "chat_1718439600000"
}

DEBUG: Rating submitted successfully!: {
  rating: 4.3,
  ratingCount: 15
}

[Alert shows: "Thank you! Your rating helps..."]
[Auto-navigates back]
```

---

## Backend Endpoint Reference

**Endpoint:** `POST /api/counselors/:counselorId/ratings`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "stars": 4,
  "comment": "Great counselor!",
  "chatId": "chat_1718439600000"
}
```

**Success Response (200):**
```json
{
  "rating": 4.3,
  "ratingCount": 15
}
```

**Error Responses:**
- `400` - Invalid data
- `401` - No token
- `403` - User role not "user"
- `404` - Counselor not found
- `500` - Server error

---

## Quick Commands for Debugging

**Check user role:**
```javascript
// React Native console
AsyncStorage.getItem('userRole').then(console.log);
```

**Check token:**
```javascript
AsyncStorage.getItem('accessToken').then(t => console.log(t?.substring(0,30)));
```

**Check pending ratings:**
```javascript
AsyncStorage.getItem('@pending_ratings').then(r => console.log(JSON.parse(r)));
```

**Check rated counselors:**
```javascript
AsyncStorage.getItem('@rated_counselors').then(r => console.log(JSON.parse(r)));
```

---

## Still Having Issues?

Share:
1. The full alert error message
2. The console debug logs (copy-paste)
3. Your user role (from AsyncStorage)
4. The counselor ID being sent

I'll help you fix it!
