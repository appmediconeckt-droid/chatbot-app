# Counselor Rating — Implementation Notes

Status: **frontend + backend implemented.** The React Native app (`chatbot-app`)
and the backend (`chatbot-backend`) both have the rating feature wired. This doc
records the API contract and what changed, so you can deploy and verify.

All endpoints use the existing `Authorization: Bearer <accessToken>` auth.

> ✅ = implemented in `chatbot-backend`   ⏳ = optional, not built yet

---

## 1. Submit a rating  ✅ required

`POST /api/counselors/:counselorId/ratings`

The user submits one rating after a session ends.

**Request body**
```json
{ "stars": 4, "comment": "Very helpful", "chatId": "chat_123" }
```
- `stars`: integer 1–5 (required)
- `comment`: string, optional (≤ 500 chars)
- `chatId`: string, optional (the session being rated)

**Behaviour**
- Save the rating (one document per rating). Recommended: enforce **one rating
  per user per chatId** (upsert) so a session can't be rated twice.
- Recompute the counselor's aggregate: `rating = avg(stars)`, `ratingCount = count`.
- Store both on the counselor document so the directory can read them cheaply.

**Response**
```json
{ "rating": 4.6, "ratingCount": 128 }
```

---

## 2. Return the aggregate on the counselor list  ✅ required

`GET /api/chat/counselors` (already exists — just add two fields per counselor)

Each counselor object must include:
```json
{ "rating": 4.6, "ratingCount": 128 }
```
- `rating`: number, the average (0 if never rated)
- `ratingCount`: number of ratings (0 if never rated)

The app also accepts `averageRating` / `totalRatings` / `reviewsCount` as
fallbacks, but `rating` + `ratingCount` is preferred.

---

## 3. End a chat session  ✅ required (this is the rating trigger)

`POST /api/chat/chat/:chatId/end`

Called when **either** the user or the counselor taps "End Session".

**Behaviour**
- Set the chat's `status` to `"ended"`.
- Emit the **existing** socket event to both participants so the other side
  updates live and the user's app shows the rating popup:
  ```js
  io.to(chatRoom(chatId)).emit('chat-status-update', { chatId, status: 'ended' });
  ```
  (The app already listens for `chat-status-update` and treats `status: 'ended'`
  as "session over → show rating popup".)

**Response**: `200` with `{ "success": true }` is enough.

---

## 4. Device token for the 24h push reminder  ⏳ later (optional)

The app currently does the 24h reminder **in-app** (it re-prompts on next open
via AsyncStorage), so this is not needed for launch. When you add Firebase/FCM:

`POST /api/users/me/device-token`
```json
{ "token": "<fcm-device-token>", "platform": "android" }
```
- Store the token against the user.
- Add a scheduled job (cron) that, ~24h after a session ended with **no rating
  submitted**, sends a push: _"How was your session? Tap to rate your counselor."_
- The app's `ratingService.registerDeviceToken()` already targets this endpoint
  and is a safe no-op until FCM is installed.

---

## Data model (implemented)

```
Rating (src/models/Rating.js) { _id, counselorId, userId, chatId, stars (1-5), comment, createdAt }
  unique sparse index: (userId, chatId)

User (src/models/userModel.js) { ..., rating: Number (default 0), ratingCount: Number (default 0) }
Chat (src/models/Chat.js) status enum now includes "ended"
```

## Backend files changed / added
- `src/models/Rating.js` — new rating collection.
- `src/models/userModel.js` — added `ratingCount`.
- `src/models/Chat.js` — added `"ended"` to the status enum.
- `src/controllers/ratingController.js` — new: `submitRating`, `getCounselorRatings`, aggregate recompute.
- `src/routes/ratingRoutes.js` — new: mounted at `/api/counselors`.
- `src/controllers/messageController.js` — new `endChat`; `ratingCount` added to counselor `select`.
- `src/routes/messageRoutes.js` — new `POST /chat/:chatId/end`.
- `src/app.js` — mounts `ratingRoutes` at `/api/counselors`.

## Deploy / verify checklist
1. Deploy the backend (push to the Render service `chatbot-backend-js25`).
2. End a chat session from either side → user's app should show the rating popup.
3. Submit a rating → counselor's `rating` / `ratingCount` update; it appears in
   the counselor directory with stars + review count.
4. Ignore the popup → it re-appears in-app on next open after 24h.

## Frontend touchpoints (for reference)
- `src/services/ratingService.js` — all API calls live here.
- `src/components/RatingModal.jsx` — the stars + comment popup.
- `src/components/StarRating.jsx` — reusable star display/input.
- `ChatBox.jsx` — user "End Session" + popup trigger + 24h in-app re-prompt.
- `SMSInput.jsx` — counselor "End Session" button.
- `CounselorDirectory.jsx` — shows real stars + review count.
