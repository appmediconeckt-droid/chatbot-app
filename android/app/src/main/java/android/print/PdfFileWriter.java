package android.print;

import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.IOException;

// Writes a PrintDocumentAdapter (e.g. a WebView's) straight to a PDF file,
// with no print dialog. LayoutResultCallback / WriteResultCallback can only be
// subclassed from inside the android.print package, hence this file's package.
public final class PdfFileWriter {

  public interface Callback {
    void onSuccess(File file);

    void onFailure(String message);
  }

  private PdfFileWriter() {}

  public static void write(
      final PrintDocumentAdapter adapter,
      PrintAttributes attributes,
      final File output,
      final Callback callback) {
    adapter.onLayout(null, attributes, null, new PrintDocumentAdapter.LayoutResultCallback() {
      @Override
      public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
        final ParcelFileDescriptor descriptor;
        try {
          File parent = output.getParentFile();
          if (parent != null && !parent.exists() && !parent.mkdirs()) {
            callback.onFailure("Could not create the PDF folder.");
            return;
          }
          descriptor = ParcelFileDescriptor.open(
              output,
              ParcelFileDescriptor.MODE_CREATE
                  | ParcelFileDescriptor.MODE_TRUNCATE
                  | ParcelFileDescriptor.MODE_READ_WRITE);
        } catch (IOException error) {
          callback.onFailure(error.getMessage());
          return;
        }
        adapter.onWrite(
            new PageRange[] {PageRange.ALL_PAGES},
            descriptor,
            null,
            new PrintDocumentAdapter.WriteResultCallback() {
              @Override
              public void onWriteFinished(PageRange[] pages) {
                close(descriptor);
                callback.onSuccess(output);
              }

              @Override
              public void onWriteFailed(CharSequence error) {
                close(descriptor);
                callback.onFailure(error == null ? "Could not write the PDF." : error.toString());
              }
            });
      }

      @Override
      public void onLayoutFailed(CharSequence error) {
        callback.onFailure(error == null ? "Could not lay out the PDF." : error.toString());
      }
    }, null);
  }

  private static void close(ParcelFileDescriptor descriptor) {
    try {
      descriptor.close();
    } catch (IOException ignored) {
      // The PDF is already written; nothing useful to do.
    }
  }
}
