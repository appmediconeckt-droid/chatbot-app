package com.chatbots

import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.AnimationDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsAnimation
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import java.lang.ref.WeakReference
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
    // Only the app itself shows the JS splash that removes this overlay; the
    // incoming-call screen runs another component and must not be covered.
    if (mainComponentName == APP_COMPONENT) {
      showSplashOverlay(glideUp = true)
      // A JS reload (dev) tears the React instance down and rebuilds it; show
      // the same splash again for that gap, so the logo, name and blink are
      // there from the first moment then too.
      reactHost?.addBeforeDestroyListener(onReactReload)
    }
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

  // The window background (splash_screen.xml) can't animate, so while the JS
  // bundle loads the same round logo — same 288dp size, centred on white — is
  // drawn on top as a blinking frame animation, with the name and tagline under
  // it. HumaeliLogoSplash draws the same screen and calls SplashOverlay.hide();
  // a timeout removes it anyway in case JS never gets there.
  private var splashOverlay: View? = null
  private var splashAnimators: List<ValueAnimator> = emptyList()

  // Runs (on a background thread) just before the React instance is destroyed
  // for a reload. Not when the activity itself is going away.
  private val onReactReload: () -> Unit = {
    runOnUiThread {
      if (!isFinishing && !isDestroyed && splashOverlay == null) showSplashOverlay()
    }
  }

  private fun showSplashOverlay(glideUp: Boolean = false) {
    val decor = window.decorView as? ViewGroup ?: return
    val density = resources.displayMetrics.density
    val size = (288 * density).toInt()
    val logo = ImageView(this).apply {
      setImageResource(R.drawable.splash_icon_animated)
      scaleType = ImageView.ScaleType.FIT_CENTER
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    // Same typography as HumaeliLogoSplash (sizes in dp, so the phone's font
    // scale doesn't change them — like allowFontScaling={false}): the name in
    // the logo's teal → green gradient, the tagline in spaced capitals between
    // two hairlines, and a quiet trust line at the bottom.
    val dp = { v: Float -> (v * density).toInt() }
    val brand = TextView(this).apply {
      text = "Humaeli"
      setTextColor(Color.parseColor("#0B7A8C"))
      setTextSize(TypedValue.COMPLEX_UNIT_DIP, 30f)
      typeface = Typeface.DEFAULT_BOLD
      letterSpacing = 1f / 30f
      gravity = Gravity.CENTER_HORIZONTAL
      maxLines = 1
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) lineHeight = dp(36f)
      // Gradient across the word itself (the view is full width, the text centred).
      addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
        val tv = v as TextView
        val textWidth = tv.paint.measureText(tv.text.toString())
        val start = (tv.width - textWidth) / 2f
        tv.paint.shader = LinearGradient(
          start, 0f, start + textWidth, 0f,
          Color.parseColor("#0B7A8C"), Color.parseColor("#2FAF8C"), Shader.TileMode.CLAMP,
        )
        tv.invalidate()
      }
    }
    val hairline = {
      View(this).apply { setBackgroundColor(Color.parseColor("#A9C6BF")) }
    }
    val tagline = TextView(this).apply {
      text = "YOUR MENTAL WELLNESS COMPANION"
      setTextColor(Color.parseColor("#5B6B7B"))
      setTextSize(TypedValue.COMPLEX_UNIT_DIP, 11f)
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
      letterSpacing = 1.6f / 11f
      maxLines = 1
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) lineHeight = dp(16f)
    }
    val taglineRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      addView(hairline(), LinearLayout.LayoutParams(dp(18f), maxOf(1, dp(1f))))
      addView(tagline, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        leftMargin = dp(10f)
        rightMargin = dp(10f)
      })
      addView(hairline(), LinearLayout.LayoutParams(dp(18f), maxOf(1, dp(1f))))
    }
    // Full width with centred lines: a wrap-content column once took a narrow
    // child's width and cut the name down to "H".
    val fullWidth = { LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT) }
    val texts = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      addView(brand, fullWidth())
      addView(taglineRow, fullWidth().apply { topMargin = dp(10f) })
    }
    val trust = TextView(this).apply {
      text = "PRIVATE  •  SECURE  •  CONFIDENTIAL"
      setTextColor(Color.parseColor("#8A9AA8"))
      setTextSize(TypedValue.COMPLEX_UNIT_DIP, 10f)
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
      letterSpacing = 1.4f / 10f
      maxLines = 1
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) lineHeight = dp(14f)
    }
    // The soft halo pulsing behind the logo — same as HumaeliLogoSplash's:
    // a 210dp teal disc growing 0.95 → 1.45 while it fades in to 14% and out,
    // every 2.2s.
    val halo = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.parseColor("#2FAF8C"))
      }
      alpha = 0f
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    val haloPulse = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 2200
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.RESTART
      interpolator = DecelerateInterpolator()
      addUpdateListener {
        val t = it.animatedValue as Float
        val scale = 0.95f + 0.5f * t
        halo.scaleX = scale
        halo.scaleY = scale
        halo.alpha = if (t < 0.2f) 0.14f * (t / 0.2f) else 0.14f * (1f - t) / 0.8f
      }
    }
    val overlay = FrameLayout(this).apply {
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(
          ContextCompat.getColor(this@MainActivity, R.color.splash_gradient_top),
          ContextCompat.getColor(this@MainActivity, R.color.splash_background),
          ContextCompat.getColor(this@MainActivity, R.color.splash_gradient_bottom),
        ),
      )
      isClickable = true
      addView(halo, FrameLayout.LayoutParams(dp(210f), dp(210f), Gravity.CENTER))
      addView(logo, FrameLayout.LayoutParams(size, size, Gravity.CENTER))
      addView(texts, FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.TOP or Gravity.CENTER_HORIZONTAL,
      ))
      // Same spot as the JS copy: 56dp above the bottom edge of the screen.
      addView(trust, FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
      ).apply { bottomMargin = dp(56f) })
    }
    // The logo + name + tagline group is lifted so it sits in the middle of
    // the screen (the logo alone at the centre left the group low). On a cold
    // start the system splash has just shown the logo dead centre, so the group
    // glides up from there; after a JS reload it simply starts lifted.
    val fullLift = SPLASH_GROUP_LIFT_DP * density
    var lift = if (glideUp) 0f else fullLift
    val place = {
      logo.translationY = -lift
      halo.translationY = -lift
      // Top of the text block: the screen centre plus the same offset as JS.
      texts.translationY = overlay.height / 2f + SPLASH_TEXT_OFFSET_DP * density - lift
    }
    overlay.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> place() }
    decor.addView(overlay, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    (logo.drawable as? AnimationDrawable)?.start()
    haloPulse.start()
    splashAnimators = listOf(haloPulse)
    if (glideUp) {
      ValueAnimator.ofFloat(0f, fullLift).apply {
        duration = 350
        startDelay = 80
        interpolator = DecelerateInterpolator(1.6f)
        addUpdateListener { lift = it.animatedValue as Float; place() }
        start()
      }
    }
    splashOverlay = overlay
    current = WeakReference(this)
    // Only this overlay: an earlier one's timer must not remove the overlay a
    // later reload put up.
    overlay.postDelayed({ if (splashOverlay === overlay) removeSplashOverlay() }, SPLASH_OVERLAY_TIMEOUT_MS)
  }

  private fun removeSplashOverlay() {
    val overlay = splashOverlay ?: return
    splashOverlay = null
    splashAnimators.forEach { it.cancel() }
    splashAnimators = emptyList()
    (0 until ((overlay as? ViewGroup)?.childCount ?: 0))
      .mapNotNull { (overlay as ViewGroup).getChildAt(it) as? ImageView }
      .forEach { (it.drawable as? AnimationDrawable)?.stop() }
    (overlay.parent as? ViewGroup)?.removeView(overlay)
  }

  override fun onDestroy() {
    reactHost?.removeBeforeDestroyListener(onReactReload)
    removeSplashOverlay()
    super.onDestroy()
  }

  companion object {
    private const val APP_COMPONENT = "chatbots"
    private const val SPLASH_OVERLAY_TIMEOUT_MS = 15000L
    // HumaeliLogoSplash's TEXT_OFFSET: 219 * (445 / 512 - 0.5) + 16.
    private const val SPLASH_TEXT_OFFSET_DP = 96.84f
    // HumaeliLogoSplash's GROUP_LIFT: the logo + text group's middle sits this
    // far below the screen centre, so the group is lifted by it.
    private const val SPLASH_GROUP_LIFT_DP = 44f
    private var current: WeakReference<MainActivity>? = null

    fun hideSplashOverlay() {
      val activity = current?.get() ?: return
      activity.runOnUiThread { activity.removeSplashOverlay() }
    }
  }

  override fun getMainComponentName(): String =
    NotifeeApiModule.getMainComponent(APP_COMPONENT)

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
