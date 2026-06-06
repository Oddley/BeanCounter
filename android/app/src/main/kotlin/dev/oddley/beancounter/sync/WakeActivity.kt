package dev.oddley.beancounter.sync

import android.os.Bundle
import androidx.activity.ComponentActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn

/**
 * Transparent stub activity registered for the `beancounter-sync://wake` URI.
 *
 * The Bean Counter PWA fires this URI when it detects that the foreground
 * service has been killed by the OS (ping fails but sidecar mode is stored).
 * Chrome on Android dispatches the URI to this activity, which restarts the
 * service and immediately finishes — no visible UI is ever shown to the user.
 */
class WakeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (GoogleSignIn.getLastSignedInAccount(this) != null) {
            SyncForegroundService.start(this)
        }
        finish()
    }
}
