package expo.modules.notificationlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val store by lazy { NotificationStore(context) }

  override fun definition() = ModuleDefinition {
    Name("NotificationListener")

    Function("isAccessGranted") {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      enabled.orEmpty().split(":").any {
        ComponentName.unflattenFromString(it)?.packageName == context.packageName
      }
    }

    Function("openAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("setAllowedPackages") { packages: List<String> ->
      store.allowedPackages = packages.toSet()
    }

    AsyncFunction("readPending") {
      store.readAll()
    }

    AsyncFunction("deletePending") { ids: List<Int> ->
      store.delete(ids)
    }
  }
}
