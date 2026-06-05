package com.clinicvoiceroom.spike

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.view.KeyEvent

class EarbudMediaButtonReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MEDIA_BUTTON) return

        val event = intent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT) ?: return
        if (MediaButtonEventRouter.dispatch(event, "broadcast receiver")) {
            abortBroadcast()
        }
    }
}

object MediaButtonEventRouter {
    @Volatile
    private var handler: ((KeyEvent, String) -> Boolean)? = null

    fun setHandler(nextHandler: ((KeyEvent, String) -> Boolean)?) {
        handler = nextHandler
    }

    fun dispatch(event: KeyEvent, source: String): Boolean {
        return handler?.invoke(event, source) ?: false
    }
}
