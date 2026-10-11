package expo.modules.loanpdf

import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper

class LoanPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LoanPdf")

    AsyncFunction("extractText") { uri: String ->
      val context = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()
      PDFBoxResourceLoader.init(context)

      val document = context.contentResolver.openInputStream(Uri.parse(uri))?.use { input ->
        PDDocument.load(input)
      } ?: throw IllegalArgumentException("The selected PDF could not be opened.")

      document.use {
        val text = PDFTextStripper().getText(it)
        if (text.isBlank()) {
          throw IllegalArgumentException("The selected PDF contains no readable text.")
        }
        text
      }
    }
  }
}
