package dev.oddley.beancounter.sync

import android.content.Context
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn

/**
 * Wraps Google Sign-In + [GoogleAuthUtil] to return a fresh Drive access token.
 *
 * [GoogleAuthUtil.getToken] handles token caching and silent refresh automatically —
 * no OAuth popup ever fires after the user has signed in once via [MainActivity].
 * All calls are blocking and must be made from a background thread (NanoHTTPD's
 * request threads are background threads, so the [LocalHttpServer] is safe to call
 * from here directly).
 */
class DriveTokenManager(private val context: Context) {

    private val driveFileScope =
        "oauth2:https://www.googleapis.com/auth/drive.file"

    /** Returns a valid access token, refreshing silently as needed. */
    @Throws(NotAuthenticatedException::class)
    fun getAccessToken(): String {
        val account = GoogleSignIn.getLastSignedInAccount(context)
            ?: throw NotAuthenticatedException("No signed-in Google account found")
        val googleAccount = account.account
            ?: throw NotAuthenticatedException("Account object is null")
        // Blocking call — handles expiry + silent token refresh transparently.
        return GoogleAuthUtil.getToken(context, googleAccount, driveFileScope)
    }

    fun isAuthenticated(): Boolean =
        GoogleSignIn.getLastSignedInAccount(context) != null

    fun getEmail(): String? =
        GoogleSignIn.getLastSignedInAccount(context)?.email

    class NotAuthenticatedException(message: String) : Exception(message)
}
