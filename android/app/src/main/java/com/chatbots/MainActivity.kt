package com.chatbots

import android.os.Bundle
import android.view.WindowManager
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Android 15+ enforces edge-to-edge for apps targeting recent SDKs. If the
    // content remains edge-to-edge, adjustResize can report the IME without
    // resizing the React content area, leaving chat composers behind the
    // keyboard. Opt the activity content back into fitted system windows and
    // let the platform resize it in sync with the native IME animation.
    WindowCompat.setDecorFitsSystemWindows(window, true)
    window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
    super.onCreate(savedInstanceState)
    if (!BuildConfig.DEBUG) {
      window.setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
      )
    }
  }

  override fun getMainComponentName(): String = "chatbots"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
