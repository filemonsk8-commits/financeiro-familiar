package com.filemon.financeirocaptura

import android.app.Activity
import android.app.NotificationManager
import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.text.format.DateFormat
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import java.util.Date

class MainActivity : Activity() {
    private lateinit var root: LinearLayout
    private val prefs by lazy { getSharedPreferences(CaixaNotificationListener.PREFS, MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        render()
    }

    override fun onResume() {
        super.onResume()
        if (::root.isInitialized) render()
    }

    private fun text(value: String, size: Float = 16f, bold: Boolean = false): TextView =
        TextView(this).apply {
            this.text = value
            textSize = size
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(0xFF172B43.toInt())
            setPadding(0, 8, 0, 8)
        }

    private fun button(label: String, action: () -> Unit): Button =
        Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        }

    private fun render() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 28, 24, 24)
            setBackgroundColor(0xFFF3F6FA.toInt())
        }
        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(text("Financeiro Familiar", 25f, true))
        content.addView(text("Captura segura de notificações", 17f))
        content.addView(text(
            "Este aplicativo não entra na sua conta da Caixa. Nesta primeira etapa, as mensagens ficam somente neste aparelho; nada é enviado para a internet.",
            14f
        ))

        val accessGranted = hasNotificationAccess()
        content.addView(text(
            if (accessGranted) "Acesso às notificações: autorizado" else "Acesso às notificações: ainda não autorizado",
            16f, true
        ))
        content.addView(button(
            if (accessGranted) "Abrir configurações de notificações" else "Autorizar acesso às notificações"
        ) {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        })

        val selected = prefs.getString(CaixaNotificationListener.KEY_SELECTED_PACKAGE, null)
        val selectedLabel = selected?.let { packageLabel(it) }
        content.addView(text("Aplicativo monitorado", 18f, true))
        content.addView(text(
            if (selected == null) "Nenhum aplicativo selecionado. Gere uma notificação da Caixa e depois escolha o aplicativo correto abaixo."
            else (selectedLabel ?: selected) + "\n" + selected,
            14f
        ))
        content.addView(button("Escolher aplicativo da Caixa") { chooseSource() })
        if (selected != null) {
            content.addView(button("Trocar aplicativo monitorado") {
                prefs.edit().remove(CaixaNotificationListener.KEY_SELECTED_PACKAGE)
                    .remove(CaixaNotificationListener.KEY_EVENTS).apply()
                render()
            })
        }

        content.addView(text("Notificações capturadas", 18f, true))
        val events = JSONArray(prefs.getString(CaixaNotificationListener.KEY_EVENTS, "[]"))
        if (events.length() == 0) {
            content.addView(text("Ainda não há mensagens. Depois de selecionar o aplicativo da Caixa, faça uma movimentação de teste ou aguarde a próxima notificação.", 14f))
        } else {
            for (i in events.length() - 1 downTo 0) {
                val event = events.optJSONObject(i) ?: continue
                val whenText = DateFormat.format("dd/MM/yyyy HH:mm", Date(event.optLong("time"))).toString()
                val title = event.optString("title")
                val message = event.optString("text")
                content.addView(text(whenText, 12f))
                content.addView(text(title, 15f, true))
                content.addView(text(message, 14f))
                val separator = TextView(this).apply {
                    text = "────────────────────────"
                    setTextColor(0xFFB7C4D2.toInt())
                }
                content.addView(separator)
            }
            content.addView(button("Apagar notificações armazenadas") {
                prefs.edit().remove(CaixaNotificationListener.KEY_EVENTS).apply()
                render()
            })
        }
        content.addView(text("Privacidade: o app só guarda o texto do aplicativo que você selecionar. Antes da seleção, registra apenas o nome e o identificador dos aplicativos que notificaram. Não envia dados para terceiros.", 12f))
        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ))
        setContentView(root)
    }

    private fun hasNotificationAccess(): Boolean {
        val component = ComponentName(this, CaixaNotificationListener::class.java)
        return if (android.os.Build.VERSION.SDK_INT >= 27) {
            getSystemService(NotificationManager::class.java)
                .isNotificationListenerAccessGranted(component)
        } else {
            Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
                ?.contains(component.flattenToString()) == true
        }
    }

    private fun chooseSource() {
        val sources = JSONArray(prefs.getString(CaixaNotificationListener.KEY_SOURCES, "[]"))
        if (sources.length() == 0) {
            AlertDialog.Builder(this)
                .setMessage("Ainda não apareceu nenhuma notificação de aplicativo. Autorize o acesso, abra a Caixa e aguarde uma notificação. Depois volte aqui.")
                .setPositiveButton("Entendi", null).show()
            return
        }
        val labels = Array(sources.length()) { i ->
            val item = sources.optJSONObject(i)
            (item?.optString("label") ?: "Aplicativo") + " — " +
                (item?.optString("package") ?: "")
        }
        AlertDialog.Builder(this)
            .setTitle("Qual é o aplicativo da Caixa?")
            .setItems(labels) { _, which ->
                val item = sources.optJSONObject(which) ?: return@setItems
                val packageName = item.optString("package")
                prefs.edit()
                    .putString(CaixaNotificationListener.KEY_SELECTED_PACKAGE, packageName)
                    .remove(CaixaNotificationListener.KEY_EVENTS)
                    .apply()
                render()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun packageLabel(packageName: String): String? = try {
        val info = packageManager.getApplicationInfo(packageName, 0)
        packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) { null }
}
