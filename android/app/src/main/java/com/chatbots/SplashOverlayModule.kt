package com.chatbots

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// JS (HumaeliLogoSplash) calls hide() once its own identical, animated splash
// is on screen, so MainActivity's native blinking overlay can go.
class SplashOverlayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SplashOverlay"

    @ReactMethod
    fun hide() {
        MainActivity.hideSplashOverlay()
    }
}
