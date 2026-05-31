package dev.oddley.beancounter.sync

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject

/**
 * NanoHTTPD server bound to 127.0.0.1:7734.
 *
 * Chrome on Android treats `http://localhost:PORT` as a secure context (special-cased
 * exemption from mixed-content blocking), so the PWA can reach this server from HTTPS.
 * Binding to 127.0.0.1 (not 0.0.0.0) ensures no other device on the network can connect.
 *
 * Endpoints:
 *   GET  /ping         → liveness check
 *   GET  /auth         → authenticated status + email
 *   GET  /connection   → stored folderId / fileId / folderName
 *   POST /connection   → PWA updates stored connection values
 *   GET  /inspect      → reads Drive file; returns InspectionResult shape
 *   POST /write        → creates or updates Drive file; returns fileId
 *
 * All responses carry `Access-Control-Allow-Origin: *` so Chrome doesn't block the
 * cross-origin requests (HTTPS PWA → HTTP localhost).
 */
class LocalHttpServer(
    private val context: Context,
    private val driveClient: DriveApiClient,
    private val tokenManager: DriveTokenManager,
) : NanoHTTPD("127.0.0.1", PORT) {

    companion object {
        const val PORT = 7734
        const val VERSION = "1.0.0"
        private const val PREFS = "beancounter_sidecar"
    }

    private val prefs get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    override fun serve(session: IHTTPSession): Response = try {
        when {
            session.method == Method.OPTIONS                               -> cors()
            session.method == Method.GET  && session.uri == "/ping"       -> handlePing()
            session.method == Method.GET  && session.uri == "/auth"       -> handleAuth()
            session.method == Method.GET  && session.uri == "/connection" -> handleGetConnection()
            session.method == Method.POST && session.uri == "/connection" -> handlePostConnection(session)
            session.method == Method.GET  && session.uri == "/inspect"    -> handleInspect(session)
            session.method == Method.POST && session.uri == "/write"      -> handleWrite(session)
            else -> json404()
        }
    } catch (e: DriveTokenManager.NotAuthenticatedException) {
        jsonError(401, "Not authenticated — open Bean Counter Sync and sign in")
    } catch (e: DriveApiClient.DriveApiException) {
        jsonError(e.status, e.message ?: "Drive API error")
    } catch (e: Exception) {
        jsonError(500, e.message ?: "Internal error")
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    private fun handlePing() = jsonOk("""{"version":"$VERSION","status":"ok"}""")

    private fun handleAuth(): Response {
        val auth = tokenManager.isAuthenticated()
        val email = tokenManager.getEmail() ?: ""
        return jsonOk("""{"authenticated":$auth,"email":"$email"}""")
    }

    private fun handleGetConnection(): Response {
        val obj = JSONObject()
        prefs.getString("folderId", null)?.let  { obj.put("folderId", it) }
        prefs.getString("fileId", null)?.let    { obj.put("fileId", it) }
        prefs.getString("folderName", null)?.let { obj.put("folderName", it) }
        return jsonOk(obj.toString())
    }

    private fun handlePostConnection(session: IHTTPSession): Response {
        val body = readBody(session)
        val obj = JSONObject(body)
        prefs.edit().apply {
            obj.optString("folderId").takeIf { it.isNotBlank() }?.let   { putString("folderId", it) }
            obj.optString("fileId").takeIf { it.isNotBlank() }?.let     { putString("fileId", it) }
            obj.optString("folderName").takeIf { it.isNotBlank() }?.let { putString("folderName", it) }
        }.apply()
        return jsonOk("""{"ok":true}""")
    }

    private fun handleInspect(session: IHTTPSession): Response {
        val params = session.parameters
        val folderId = params["folderId"]?.firstOrNull()
            ?: prefs.getString("folderId", null)
            ?: return jsonError(400, "folderId required (pass as query param or POST /connection first)")
        val knownFileId = params["fileId"]?.firstOrNull()
            ?: prefs.getString("fileId", null)

        val result = driveClient.inspectFile(folderId, knownFileId)
        val obj = when (result) {
            is InspectionResult.Empty -> JSONObject()
                .put("kind", "empty")
                .put("folderId", result.folderId)

            is InspectionResult.Exists -> {
                // Cache the file id so subsequent reads skip the folder search
                prefs.edit().putString("fileId", result.fileId).apply()
                JSONObject()
                    .put("kind", "exists")
                    .put("folderId", result.folderId)
                    .put("fileId", result.fileId)
                    .put("content", result.content)
                    .apply { result.etag?.let { put("etag", it) } }
            }

            is InspectionResult.Unreadable -> JSONObject()
                .put("kind", "unreadable")
                .put("folderId", result.folderId)
                .put("fileId", result.fileId)
                .put("error", result.error)
        }
        return jsonOk(obj.toString())
    }

    private fun handleWrite(session: IHTTPSession): Response {
        val body = readBody(session)
        val obj = JSONObject(body)
        val folderId = obj.optString("folderId").ifBlank { prefs.getString("folderId", null) }
            ?: return jsonError(400, "folderId required")
        val content        = obj.getString("content")
        val existingFileId = obj.optString("existingFileId").ifBlank { null }
        val fileName       = obj.optString("fileName").ifBlank { "active.json" }
        val ifMatch        = obj.optString("ifMatch").ifBlank { null }

        val fileId = driveClient.writeFile(folderId, content, existingFileId, fileName, ifMatch)
        prefs.edit().putString("fileId", fileId).apply()
        return jsonOk("""{"fileId":"$fileId"}""")
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun readBody(session: IHTTPSession): String {
        val len = session.headers["content-length"]?.toIntOrNull() ?: 0
        if (len == 0) return "{}"
        val buf = ByteArray(len)
        session.inputStream.read(buf, 0, len)
        return String(buf, Charsets.UTF_8)
    }

    private fun jsonOk(body: String): Response {
        val r = newFixedLengthResponse(Response.Status.OK, "application/json", body)
        addCorsHeaders(r)
        return r
    }

    private fun jsonError(code: Int, message: String): Response {
        val status = when (code) {
            400  -> Response.Status.BAD_REQUEST
            401  -> Response.Status.UNAUTHORIZED
            404  -> Response.Status.NOT_FOUND
            412  -> Response.Status.PRECONDITION_FAILED
            else -> Response.Status.INTERNAL_ERROR
        }
        val body = """{"error":${JSONObject.quote(message)}}"""
        val r = newFixedLengthResponse(status, "application/json", body)
        addCorsHeaders(r)
        return r
    }

    private fun json404() = jsonError(404, "Unknown endpoint")

    private fun cors(): Response {
        val r = newFixedLengthResponse(Response.Status.OK, "text/plain", "")
        addCorsHeaders(r)
        return r
    }

    private fun addCorsHeaders(r: Response) {
        r.addHeader("Access-Control-Allow-Origin", "*")
        r.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        r.addHeader("Access-Control-Allow-Headers", "Content-Type")
    }
}
