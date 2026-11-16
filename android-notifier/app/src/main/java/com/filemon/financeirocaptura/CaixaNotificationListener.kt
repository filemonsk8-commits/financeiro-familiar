package com.filemon.financeirocaptura

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class CaixaNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val selected = prefs.getString(KEY_SELECTED_PACKAGE, null)
        val packageName = sbn.packageName ?: return

        // Antes da escolha, guardamos somente nome e pacote do app de origem.
        if (selected.isNullOrBlank()) {
            val sources = JSONArray(prefs.getString(KEY_SOURCES, "[]"))
            val known = (0 until sources.length()).any {
                sources.optJSONObject(it)?.optString("package") == packageName
            }
            if (!known) {
                val label = try {
                    val app = packageManager.getApplicationInfo(packageName, 0)
                    packageManager.getApplicationLabel(app).toString()
                } catch (_: Exception) { packageName }
                sources.put(JSONObject().put("package", packageName).put("label", label))
                while (sources.length() > 12) sources.remove(0)
                prefs.edit().putString(KEY_SOURCES, sources.toString()).apply()
            }
            return
        }

        // Nunca captura notificações de outros aplicativos.
        if (packageName != selected) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString().orEmpty()
        val text = extras.getCharSequence("android.text")?.toString().orEmpty()
        val bigText = extras.getCharSequence("android.bigText")?.toString().orEmpty()
        val message = if (bigText.isNotBlank()) bigText else text
        if (title.isBlank() && message.isBlank()) return

        val events = JSONArray(prefs.getString(KEY_EVENTS, "[]"))
        val eventKey = packageName + "|" + sbn.key + "|" + sbn.postTime
        val duplicate = (0 until events.length()).any {
            events.optJSONObject(it)?.optString("key") == eventKey
        }
        if (duplicate) return

        events.put(JSONObject()
            .put("key", eventKey)
            .put("title", title.take(180))
            .put("text", message.take(700))
            .put("time", sbn.postTime))
        while (events.length() > 100) events.remove(0)
        prefs.edit().putString(KEY_EVENTS, events.toString()).apply()
    }

    companion object {
        const val PREFS = "captura_local"
        const val KEY_SELECTED_PACKAGE = "selected_package"
        const val KEY_SOURCES = "seen_sources"
        const val KEY_EVENTS = "captured_events"
    }
}
