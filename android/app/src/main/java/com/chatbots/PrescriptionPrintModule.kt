package com.chatbots

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.print.PdfFileWriter
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil
import java.io.File
import java.io.FileOutputStream

// Turns the patient's prescription (an HTML page) into a real document:
//   createPdf → lays it out in an off-screen WebView and writes an A4 PDF
//               into the app cache (shareable through the FileProvider);
//   sharePdf  → opens the share sheet with that PDF (WhatsApp, Gmail, Drive…);
//   printHtml → Android's print dialog (printer or "Save as PDF").
class PrescriptionPrintModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  // The WebView must stay referenced until its print adapter has finished.
  private var renderWebView: WebView? = null

  override fun getName(): String = "PrescriptionPrint"

  private fun a4Attributes(): PrintAttributes =
    PrintAttributes.Builder()
      .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
      .setResolution(PrintAttributes.Resolution("pdf", "pdf", 600, 600))
      .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
      .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
      .build()

  // Loads `html` off-screen and calls `onReady` once the page has rendered.
  private fun renderHtml(context: Context, html: String, promise: Promise, onReady: (WebView) -> Unit) {
    UiThreadUtil.runOnUiThread {
      try {
        val webView = WebView(context)
        webView.webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView, url: String?) {
            onReady(view)
          }
        }
        renderWebView = webView
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
      } catch (error: Exception) {
        renderWebView = null
        promise.reject("RENDER_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun createPdf(html: String, fileName: String?, promise: Promise) {
    val safeName = (fileName ?: "Prescription").replace(Regex("[^A-Za-z0-9_-]+"), "_").trim('_')
      .ifBlank { "Prescription" }
    val output = File(File(reactContext.cacheDir, "prescriptions"), "$safeName.pdf")
    output.parentFile?.mkdirs()
    renderHtml(reactContext, html, promise) { view ->
      val jobName = safeName
      PdfFileWriter.write(
        view.createPrintDocumentAdapter(jobName),
        a4Attributes(),
        output,
        object : PdfFileWriter.Callback {
          override fun onSuccess(file: File) {
            renderWebView = null
            promise.resolve(file.absolutePath)
          }

          override fun onFailure(message: String?) {
            renderWebView = null
            promise.reject("PDF_FAILED", message ?: "Could not create the PDF.")
          }
        },
      )
    }
  }

  @ReactMethod
  fun sharePdf(filePath: String, title: String?, promise: Promise) {
    try {
      val file = File(filePath.removePrefix("file://"))
      if (!file.exists()) {
        promise.reject("PDF_NOT_FOUND", "The prescription PDF was not found.")
        return
      }
      val uri = FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", file)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, title ?: "Prescription")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, title ?: "Share prescription").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      reactContext.startActivity(chooser)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("PDF_SHARE_FAILED", error.message, error)
    }
  }

  // Renders a hand-drawn signature (from the app's signature pad) to a
  // transparent PNG. `strokes` is a list of strokes, each a flat list of
  // x,y points in pad coordinates (width × height). Resolves the file path.
  @ReactMethod
  fun renderSignaturePng(strokes: ReadableArray, width: Double, height: Double, promise: Promise) {
    try {
      val scale = 3f
      val bitmap = Bitmap.createBitmap(
        (width * scale).toInt().coerceAtLeast(1),
        (height * scale).toInt().coerceAtLeast(1),
        Bitmap.Config.ARGB_8888,
      )
      val canvas = Canvas(bitmap)
      val paint = Paint().apply {
        isAntiAlias = true
        color = Color.parseColor("#0B1F4D")
        style = Paint.Style.STROKE
        strokeWidth = 3.2f * scale
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
      }
      for (i in 0 until strokes.size()) {
        val points = strokes.getArray(i) ?: continue
        if (points.size() < 2) continue
        val path = Path()
        var prevX = points.getDouble(0).toFloat() * scale
        var prevY = points.getDouble(1).toFloat() * scale
        path.moveTo(prevX, prevY)
        if (points.size() < 4) {
          // A tap: draw a dot.
          path.lineTo(prevX + 0.1f, prevY + 0.1f)
        }
        var j = 2
        while (j + 1 < points.size()) {
          val x = points.getDouble(j).toFloat() * scale
          val y = points.getDouble(j + 1).toFloat() * scale
          // Smooth curve through midpoints, like a real pen line.
          path.quadTo(prevX, prevY, (prevX + x) / 2f, (prevY + y) / 2f)
          prevX = x
          prevY = y
          j += 2
        }
        path.lineTo(prevX, prevY)
        canvas.drawPath(path, paint)
      }
      val dir = File(reactContext.cacheDir, "signatures").apply { mkdirs() }
      val file = File(dir, "signature-${System.currentTimeMillis()}.png")
      FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
      bitmap.recycle()
      promise.resolve(file.absolutePath)
    } catch (error: Exception) {
      promise.reject("SIGNATURE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun printHtml(html: String, jobName: String?, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("PRINT_NO_ACTIVITY", "The app is not in the foreground.")
      return
    }
    val name = if (jobName.isNullOrBlank()) "Prescription" else jobName
    renderHtml(activity, html, promise) { view ->
      try {
        val printManager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
        printManager.print(name, view.createPrintDocumentAdapter(name), a4Attributes())
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("PRINT_FAILED", error.message, error)
      } finally {
        renderWebView = null
      }
    }
  }
}
