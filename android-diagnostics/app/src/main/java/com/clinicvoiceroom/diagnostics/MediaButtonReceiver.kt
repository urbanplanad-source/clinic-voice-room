package com.clinicvoiceroom.diagnostics

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.view.KeyEvent

class MediaButtonReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MEDIA_BUTTON) return

        @Suppress("DEPRECATION")
        val event = intent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT) ?: return
        if (MediaButtonRouter.dispatch(event, "broadcast receiver")) {
            runCatching { abortBroadcast() }
        }
    }
}

object MediaButtonRouter {
    @Volatile
    private var handler: ((KeyEvent, String) -> Boolean)? = null

    fun setHandler(nextHandler: ((KeyEvent, String) -> Boolean)?) {
        handler = nextHandler
    }

    fun dispatch(event: KeyEvent, source: String): Boolean {
        return handler?.invoke(event, source) ?: false
    }
}
