package dev.oddley.beancounter.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Foreground service that runs the [LocalHttpServer] for the duration of a sync burst.
 *
 * Lifecycle:
 *   - Started from [MainActivity] after sign-in, from [BootReceiver] after reboot, and
 *     from [WakeActivity] whenever the PWA needs the sidecar and finds it not running.
 *   - Self-stops after [IDLE_TIMEOUT_MS] of no HTTP requests — this is a bursty,
 *     around-sync-events service, not a 24/7 one, so it never approaches the
 *     6-hour cumulative runtime cap Android 15+ enforces on the `dataSync`
 *     foreground service type. That cap is what previously caused the OS to kill
 *     this service with an ANR-style "did not stop within its timeout" crash.
 *   - [START_NOT_STICKY]: the OS should not auto-restart this after it self-stops
 *     or is killed; the PWA re-wakes it on demand via `beancounter-sync://wake`.
 *
 * Notification:
 *   - Required to stay alive as a foreground service (Android 8+).
 *   - Low importance — no sound, no heads-up; appears in shade as a silent persistent row.
 *   - Tapping it opens [MainActivity].
 */
class SyncForegroundService : Service() {

    private var server: LocalHttpServer? = null
    private val handler = Handler(Looper.getMainLooper())
    private val idleTimeout = Runnable { stopSelf() }

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "beancounter_sync_v1"

        // Comfortably covers a full sync burst (a handful of requests over a
        // few seconds) with margin for a slow Drive round trip, while keeping
        // total runtime far below the OS's 6-hour dataSync cap.
        private const val IDLE_TIMEOUT_MS = 120_000L

        fun start(context: Context) {
            context.startForegroundService(Intent(context, SyncForegroundService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, SyncForegroundService::class.java))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()
        // targetSdk 34+ requires the service type to be passed to startForeground().
        // ServiceCompat handles the version check: passes the type on API 34+,
        // calls the two-arg form on older devices.
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
        if (server == null) {
            try {
                val tokenManager = DriveTokenManager(this)
                server = LocalHttpServer(
                    this,
                    DriveApiClient(tokenManager),
                    tokenManager,
                    onRequest = ::resetIdleTimeout,
                ).apply { start() }
            } catch (e: Exception) {
                stopSelf()
                return START_NOT_STICKY
            }
        }
        resetIdleTimeout()
        return START_NOT_STICKY
    }

    private fun resetIdleTimeout() {
        handler.removeCallbacks(idleTimeout)
        handler.postDelayed(idleTimeout, IDLE_TIMEOUT_MS)
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    override fun onTimeout(startId: Int, fgsType: Int) {
        // Defensive safety net: if the OS ever considers this service to have
        // exceeded its dataSync runtime budget, stop cleanly instead of letting
        // the system throw and crash the process.
        stopSelf()
    }

    override fun onDestroy() {
        handler.removeCallbacks(idleTimeout)
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
