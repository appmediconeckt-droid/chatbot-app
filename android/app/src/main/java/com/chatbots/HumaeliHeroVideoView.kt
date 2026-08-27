package com.chatbots

import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.view.Surface
import android.view.TextureView
import android.widget.FrameLayout
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.uimanager.ThemedReactContext

class HumaeliHeroVideoView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext),
  LifecycleEventListener {

  private val textureView = TextureView(reactContext)
  private var mediaPlayer: MediaPlayer? = null
  private var surface: Surface? = null
  // Wait for React Native to provide the requested source. Starting the landing
  // video by default can briefly show the wrong clip in reused video cards.
  private var sourceName: String = ""
  private var muted: Boolean = false
  private var resizeMode: String = "cover"
  private var focusX: Float = 0.5f
  private var focusY: Float = 0.5f
  private var zoomScale: Float = 1f
  private var shouldPlay: Boolean = true

  init {
    addView(textureView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    reactContext.addLifecycleEventListener(this)

    textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
      override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        startVideo(surfaceTexture)
      }

      override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        applyResizeMode()
      }

      override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        releasePlayer()
        return true
      }

      override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) = Unit
    }
  }

  fun setSourceName(value: String?) {
    val nextSource = value?.trim().orEmpty().ifBlank { "mobile_hero_section_video" }
    if (sourceName == nextSource) return

    sourceName = nextSource
    textureView.surfaceTexture?.let { startVideo(it) }
  }

  fun setMuted(value: Boolean) {
    muted = value
    mediaPlayer?.setVolume(if (muted) 0f else 1f, if (muted) 0f else 1f)
  }

  fun setResizeMode(value: String?) {
    resizeMode = value?.trim()?.lowercase().orEmpty().ifBlank { "cover" }
    applyResizeMode()
  }

  fun setFocusX(value: Float) {
    focusX = value.coerceIn(0f, 1f)
    applyResizeMode()
  }

  fun setFocusY(value: Float) {
    focusY = value.coerceIn(0f, 1f)
    applyResizeMode()
  }

  fun setZoomScale(value: Float) {
    zoomScale = value.coerceIn(0.85f, 1.25f)
    applyResizeMode()
  }

  private fun startVideo(surfaceTexture: SurfaceTexture) {
    releasePlayer()

    val resourceId = resources.getIdentifier(sourceName, "raw", reactContext.packageName)
    if (resourceId == 0) return

    val assetFileDescriptor = resources.openRawResourceFd(resourceId) ?: return
    surface = Surface(surfaceTexture)

    mediaPlayer = MediaPlayer().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
          .build()
      )
      setSurface(surface)
      setDataSource(
        assetFileDescriptor.fileDescriptor,
        assetFileDescriptor.startOffset,
        assetFileDescriptor.length
      )
      isLooping = true
      setVolume(if (muted) 0f else 1f, if (muted) 0f else 1f)
      setOnPreparedListener {
        applyResizeMode()
        if (shouldPlay) it.start()
      }
      setOnVideoSizeChangedListener { _, _, _ -> applyResizeMode() }
      setOnErrorListener { _, _, _ -> true }
      prepareAsync()
    }

    assetFileDescriptor.close()
  }

  private fun applyResizeMode() {
    val player = mediaPlayer ?: return
    val videoWidth = player.videoWidth
    val videoHeight = player.videoHeight
    val viewWidth = textureView.width
    val viewHeight = textureView.height

    if (videoWidth <= 0 || videoHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) return

    val widthScale = viewWidth.toFloat() / videoWidth
    val heightScale = viewHeight.toFloat() / videoHeight
    val scale = when (resizeMode) {
      "contain" -> minOf(widthScale, heightScale)
      "fitwidth" -> widthScale
      else -> maxOf(widthScale, heightScale)
    } * zoomScale
    val scaledWidth = videoWidth * scale
    val scaledHeight = videoHeight * scale
    val dx = (viewWidth - scaledWidth) * focusX
    val dy = (viewHeight - scaledHeight) * focusY
    val viewScaleX = scaledWidth / viewWidth
    val viewScaleY = scaledHeight / viewHeight

    textureView.setTransform(
      Matrix().apply {
        setScale(viewScaleX, viewScaleY)
        postTranslate(dx, dy)
      }
    )
  }

  private fun pauseVideo() {
    shouldPlay = false
    if (mediaPlayer?.isPlaying == true) {
      mediaPlayer?.pause()
    }
  }

  private fun resumeVideo() {
    shouldPlay = true
    mediaPlayer?.let {
      if (!it.isPlaying) it.start()
    } ?: textureView.surfaceTexture?.let { startVideo(it) }
  }

  private fun releasePlayer() {
    mediaPlayer?.let { player ->
      runCatching {
        if (player.isPlaying) player.stop()
        player.reset()
        player.release()
      }
    }
    mediaPlayer = null
    surface?.release()
    surface = null
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    resumeVideo()
  }

  override fun onDetachedFromWindow() {
    pauseVideo()
    releasePlayer()
    reactContext.removeLifecycleEventListener(this)
    super.onDetachedFromWindow()
  }

  override fun onHostResume() {
    resumeVideo()
  }

  override fun onHostPause() {
    pauseVideo()
  }

  override fun onHostDestroy() {
    releasePlayer()
  }
}
