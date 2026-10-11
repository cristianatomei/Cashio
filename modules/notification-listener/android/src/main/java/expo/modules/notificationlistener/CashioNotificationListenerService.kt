package expo.modules.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class CashioNotificationListenerService : NotificationListenerService() {
  private val store by lazy { NotificationStore(this) }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName !in store.allowedPackages) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: return

    store.insert(sbn.packageName, title, body, sbn.postTime)
  }
}
