package com.chatbots

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class PdfFileOpenerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PdfFileOpener"

  @ReactMethod
  fun open(filePath: String, promise: Promise) {
    try {
      val file = File(filePath.removePrefix("file://"))
      if (!file.exists()) {
        promise.reject("PDF_NOT_FOUND", "Prescription file was not found.")
        return
      }

      val uri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        file,
      )

      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/pdf")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      reactContext.startActivity(Intent.createChooser(intent, "Open prescription").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      })
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("PDF_OPEN_FAILED", error.message, error)
    }
  }
}
