package expo.modules.productivity

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal fun launchCashio(context: Context, add: Boolean): Intent {
  val scheme = if (context.packageName.endsWith(".e2e")) "cashio-e2e" else "cashio"
  val route = if (add) "/add-transaction" else "/"
  return (context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent())
    .setAction(Intent.ACTION_VIEW)
    .setData(Uri.parse("$scheme://$route"))
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
}

internal fun cashioPendingIntent(context: Context, add: Boolean): PendingIntent =
  PendingIntent.getActivity(context, if (add) 1 else 0, launchCashio(context, add),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

class CashioWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val prefs = context.getSharedPreferences("cashio_productivity", Context.MODE_PRIVATE)
    val month = SimpleDateFormat("yyyy-MM", Locale.ROOT).format(Date())
    val amount = when {
      prefs.getBoolean("private", true) -> context.getString(R.string.cashio_private)
      prefs.getString("month", "") != month -> context.getString(R.string.cashio_refresh)
      else -> prefs.getString("summary", context.getString(R.string.cashio_refresh))
    }
    ids.forEach { id ->
      val views = RemoteViews(context.packageName, R.layout.cashio_widget)
      views.setTextViewText(R.id.cashio_amount, amount)
      views.setOnClickPendingIntent(R.id.cashio_amount, cashioPendingIntent(context, false))
      views.setOnClickPendingIntent(R.id.cashio_add_button, cashioPendingIntent(context, true))
      manager.updateAppWidget(id, views)
    }
  }

  companion object {
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      CashioWidget().onUpdate(context, manager,
        manager.getAppWidgetIds(ComponentName(context, CashioWidget::class.java)))
    }
  }
}
