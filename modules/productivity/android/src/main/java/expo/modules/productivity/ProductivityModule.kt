package expo.modules.productivity

import android.content.Context
import android.app.NotificationManager
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ProductivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CashioProductivity")

    Function("update") { summary: String, month: String, privateMode: Boolean ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val prefs = context.getSharedPreferences("cashio_productivity", Context.MODE_PRIVATE)
      if (privateMode && !prefs.getBoolean("private", true) &&
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.getSystemService(NotificationManager::class.java)?.let { manager ->
          manager.activeNotifications.filter { it.notification.channelId == "cashio_capture" }
            .forEach { manager.cancel(it.tag, it.id) }
        }
      }
      // Never retain an unredacted balance in the widget cache while app lock is enabled.
      val saved = prefs.edit()
        .putString("summary", if (privateMode) "" else summary)
        .putString("month", month)
        .putBoolean("private", privateMode)
        .commit()
      check(saved) { "Unable to save private widget state" }
      CashioWidget.refresh(context)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
        val shortcut = ShortcutInfo.Builder(context, "cashio_add")
          .setShortLabel(context.getString(R.string.cashio_add))
          .setIcon(Icon.createWithResource(context, R.drawable.cashio_add))
          .setIntent(launchCashio(context, true))
          .build()
        context.getSystemService(ShortcutManager::class.java)?.setDynamicShortcuts(listOf(shortcut))
      }
    }
  }
}
