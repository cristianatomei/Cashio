package expo.modules.notificationlistener

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

// Native-owned queue: the service can run while JS is not, so JS drains it later.
class NotificationStore(context: Context) :
  SQLiteOpenHelper(context.applicationContext, "notification_inbox.db", null, 1) {

  private val prefs =
    context.applicationContext.getSharedPreferences("cashio_listener", Context.MODE_PRIVATE)

  var allowedPackages: Set<String>
    get() = prefs.getStringSet(ALLOWED_KEY, emptySet()) ?: emptySet()
    set(value) = prefs.edit().putStringSet(ALLOWED_KEY, value).apply()

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE pending (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_name TEXT NOT NULL,
        title TEXT,
        body TEXT NOT NULL,
        posted_at INTEGER NOT NULL
      )
      """.trimIndent()
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  fun insert(packageName: String, title: String?, body: String, postedAt: Long) {
    val values = ContentValues().apply {
      put("package_name", packageName)
      put("title", title)
      put("body", body)
      put("posted_at", postedAt)
    }
    writableDatabase.insert("pending", null, values)
  }

  fun readAll(): List<Map<String, Any?>> {
    val rows = mutableListOf<Map<String, Any?>>()
    readableDatabase.query("pending", null, null, null, null, null, "id ASC").use { c ->
      while (c.moveToNext()) {
        rows.add(
          mapOf(
            "id" to c.getInt(c.getColumnIndexOrThrow("id")),
            "packageName" to c.getString(c.getColumnIndexOrThrow("package_name")),
            "title" to c.getString(c.getColumnIndexOrThrow("title")),
            "body" to c.getString(c.getColumnIndexOrThrow("body")),
            "postedAt" to c.getLong(c.getColumnIndexOrThrow("posted_at")),
          )
        )
      }
    }
    return rows
  }

  fun delete(ids: List<Int>) {
    if (ids.isEmpty()) return
    val placeholders = ids.joinToString(",") { "?" }
    writableDatabase.delete("pending", "id IN ($placeholders)", ids.map { it.toString() }.toTypedArray())
  }

  private companion object {
    const val ALLOWED_KEY = "allowed_packages"
  }
}
