package com.chatbots

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class HumaeliHeroVideoViewManager : SimpleViewManager<HumaeliHeroVideoView>() {
  override fun getName(): String = "HumaeliHeroVideo"

  override fun createViewInstance(reactContext: ThemedReactContext): HumaeliHeroVideoView =
    HumaeliHeroVideoView(reactContext)

  @ReactProp(name = "sourceName")
  fun setSourceName(view: HumaeliHeroVideoView, sourceName: String?) {
    view.setSourceName(sourceName)
  }

  @ReactProp(name = "muted", defaultBoolean = false)
  fun setMuted(view: HumaeliHeroVideoView, muted: Boolean) {
    view.setMuted(muted)
  }

  @ReactProp(name = "resizeMode")
  fun setResizeMode(view: HumaeliHeroVideoView, resizeMode: String?) {
    view.setResizeMode(resizeMode)
  }

  @ReactProp(name = "focusX", defaultFloat = 0.5f)
  fun setFocusX(view: HumaeliHeroVideoView, focusX: Float) {
    view.setFocusX(focusX)
  }

  @ReactProp(name = "focusY", defaultFloat = 0.5f)
  fun setFocusY(view: HumaeliHeroVideoView, focusY: Float) {
    view.setFocusY(focusY)
  }

  @ReactProp(name = "zoomScale", defaultFloat = 1f)
  fun setZoomScale(view: HumaeliHeroVideoView, zoomScale: Float) {
    view.setZoomScale(zoomScale)
  }
}
