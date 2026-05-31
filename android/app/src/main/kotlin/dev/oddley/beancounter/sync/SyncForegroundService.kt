package dev.oddley.beancounter.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the [LocalHttpServer] running while the device is on.
 *
 * Lifecycle:
 *   - Started from [MainActivity] after sign-in, and from [BootReceiver] after reboot.
 *   - [START_STICKY]: Android restarts it automatically if it's killed by the OS.
 *   - The server listens on localhost:7734; the PWA pings this on every sync attempt.
 *
 * Notification:
 *   - Required to stay alive as a foreground service (Android 8+).
 *   - Low importance — no sound, no heads-up; appears in shade as a silent persistent row.
 *   - Tapping it opens [MainActivity].
 */
class SyncForegroundService : Service() {

    private var server: LocalHttpServer? = null

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "beancounter_sync_v1"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, SyncForegroundService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, SyncForegroundService::class.java))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        if (server == null) {
            val tokenManager = DriveTokenManager(this)
            server = LocalHttpServer(this, DriveApiClient(tokenManager), tokenManager).apply {
                start()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        server?.stop()
        server = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    private fun ensureChannel() {
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
        val ch = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply { description = getString(R.string.notification_channel_desc) }
        mgr.createNotificationChannel(ch)
    }
}
