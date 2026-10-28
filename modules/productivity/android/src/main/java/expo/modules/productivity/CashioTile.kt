package expo.modules.productivity

import android.os.Build
import android.service.quicksettings.TileService

class CashioTile : TileService() {
  override fun onClick() {
    super.onClick()
    unlockAndRun {
      if (Build.VERSION.SDK_INT >= 34) {
        startActivityAndCollapse(cashioPendingIntent(this, true))
      } else {
        @Suppress("DEPRECATION")
        startActivityAndCollapse(launchCashio(this, true))
      }
    }
  }
}
