package com.chatbots

import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsAnimation
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import io.invertase.notifee.NotifeeApiModule

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Let Android resize the React window when the keyboard opens. The chat
    // composers still measure any remaining overlay on devices that ignore
    // adjustResize, but this keeps inputs above the IME on devices where
    // React Native keyboard events are limited under adjustNothing.
    window.setSoftInputMode(
      WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN or
        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
    )
    super.onCreate(savedInstanceState)
    reportKeyboardWhenSettled()
    if (!BuildConfig.DEBUG) {
      window.setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
      )
    }
  }

  // React Native only notices the keyboard (keyboardDidShow / keyboardDidHide)
  // during a layout pass. Edge-to-edge windows are not resized for the IME, so
  // on 3-button-navigation phones nothing lays out when the keyboard opens or
  // closes, and the event waited for some unrelated re-render: the chat
  // composer stayed under the keyboard, or a blank strip stayed after it
  // closed, for a second or more.
  //
  // So the keyboard is reported here as soon as its slide starts: the show
  // with the final size (the animation's upper bound), and the hide too, which
  // React Native alone would only see once the slide-down has ended. A layout
  // pass is still requested at start and end so React Native's own state
  // follows. If a close turns back into an open (field tapped mid-slide) the
  // show is re-sent, because React Native never saw the keyboard as closed.
  private fun reportKeyboardWhenSettled() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    val content = findViewById<View>(android.R.id.content) ?: return
    content.setWindowInsetsAnimationCallback(
      object : WindowInsetsAnimation.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
        private var closing = false

        override fun onPrepare(animation: WindowInsetsAnimation) {
          if (animation.typeMask and WindowInsets.Type.ime() != 0) {
            closing = content.rootWindowInsets?.isVisible(WindowInsets.Type.ime()) == true
          }
        }

        override fun onProgress(
          insets: WindowInsets,
          runningAnimations: MutableList<WindowInsetsAnimation>,
        ): WindowInsets = insets

        // The slide is just starting; its upper bound is the full keyboard
        // inset, so the composer can be told its final place right away.
        override fun onStart(
          animation: WindowInsetsAnimation,
          bounds: WindowInsetsAnimation.Bounds,
        ): WindowInsetsAnimation.Bounds {
          if (animation.typeMask and WindowInsets.Type.ime() != 0) {
            emitKeyboardEvent(if (closing) null else bounds.upperBound.bottom)
            window.decorView.requestLayout()
          }
          return bounds
        }

        override fun onEnd(animation: WindowInsetsAnimation) {
          if (animation.typeMask and WindowInsets.Type.ime() != 0) {
            val insets = content.rootWindowInsets
            if (closing && insets?.isVisible(WindowInsets.Type.ime()) == true) {
              emitKeyboardEvent(insets.getInsets(WindowInsets.Type.ime()).bottom)
            }
            closing = false
            window.decorView.requestLayout()
          }
        }
      }
    )
  }

  // Same event names and payload as React Native's ReactRootView, in dp.
  // `imeBottom` (px up from the window's bottom edge) null = keyboardDidHide.
  private fun emitKeyboardEvent(imeBottom: Int?) {
    val context = reactHost?.currentReactContext ?: return
    val density = resources.displayMetrics.density
    val decor = window.decorView
    // Keyboard top in screen coordinates, like React Native reports it: on some
    // phones the window starts below the status bar, not at the screen top.
    val windowTop = IntArray(2).also { decor.getLocationOnScreen(it) }[1]
    val barsBottom =
      decor.rootWindowInsets?.getInsets(WindowInsets.Type.systemBars())?.bottom ?: 0
    // A few px means the keyboard is not really there; leave it to React Native.
    if (imeBottom != null && imeBottom - barsBottom < 120 * density) return
    val end = Arguments.createMap().apply {
      putDouble("height", (if (imeBottom == null) 0 else imeBottom - barsBottom) / density.toDouble())
      putDouble("screenX", 0.0)
      putDouble("width", decor.width / density.toDouble())
      putDouble("screenY", (windowTop + decor.height - (imeBottom ?: 0)) / density.toDouble())
    }
    val payload = Arguments.createMap().apply {
      putMap("endCoordinates", end)
      putString("easing", "keyboard")
      putDouble("duration", 0.0)
    }
    context.emitDeviceEvent(if (imeBottom == null) "keyboardDidHide" else "keyboardDidShow", payload)
  }

  override fun getMainComponentName(): String =
    NotifeeApiModule.getMainComponent("chatbots")

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
