package dev.oddley.beancounter.sync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.signin.GoogleSignIn

/**
 * Restarts [SyncForegroundService] after the device reboots.
 *
 * Only starts the service if the user has already signed in — no-op otherwise so a
 * fresh install that's never been set up doesn't show a notification on boot.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        // Don't start unless the user has already signed in
        if (GoogleSignIn.getLastSignedInAccount(context) == null) return
        SyncForegroundService.start(context)
    }
}
