package com.chatbots

import android.content.Intent
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService

/**
 * Stops Firebase from drawing `notification` pushes itself while the app is in
 * the background or closed. Firebase's own notification only gets the
 * single-colour status-bar icon. With the display flag stripped the push is
 * handled like a data message, and the JS background handler
 * (src/services/notificationService.js) shows it through notifee with the
 * Humaeli logo on its white plate. The backend payload is left unchanged.
 */
class HumaeliMessagingService : ReactNativeFirebaseMessagingService() {
  override fun handleIntent(intent: Intent) {
    // Firebase's NotificationParams.isNotification() checks exactly these keys.
    intent.removeExtra("gcm.n.e")
    intent.removeExtra("gcm.notification.e")
    super.handleIntent(intent)
  }
}
