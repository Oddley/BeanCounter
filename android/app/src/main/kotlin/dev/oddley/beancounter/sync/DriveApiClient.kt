package dev.oddley.beancounter.sync

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder

/**
 * OkHttp-based Drive v3 REST client.
 *
 * Mirrors the operations exposed by the PWA's `shell/drive/api.ts`:
 *   - [inspectFile] → combines listFiles + readFileContent into the InspectionResult shape
 *   - [writeFile]   → multipart create or media PATCH (with optional ETag / If-Match)
 *
 * All methods are blocking and throw [DriveApiException] on non-2xx responses.
 * Call from background threads only (NanoHTTPD request threads qualify).
 */
class DriveApiClient(private val tokenManager: DriveTokenManager) {

    private val http = OkHttpClient()

    // ── Public API ──────────────────────────────────────────────────────────

    data class FileContent(val content: String, val etag: String?)

    class DriveApiException(message: String, val status: Int) : IOException(message)

    /**
     * Reads the active.json file from Drive, returning a result that mirrors
     * the PWA's `InspectionResult` discriminated union.
     *
     * @param knownFileId If supplied, fetches the file directly (fast path).
     *                    Falls back to a folder search when null.
     */
    fun inspectFile(folderId: String, knownFileId: String?): InspectionResult {
        val token = tokenManager.getAccessToken()
        if (knownFileId != null) {
            return try {
                val (content, etag) = readContent(token, knownFileId)
                InspectionResult.Exists(folderId, knownFileId, content, etag)
            } catch (e: DriveApiException) {
                InspectionResult.Unreadable(folderId, knownFileId, e.message ?: "Read failed")
            }
        }
        // Folder search path
        val query = "'${folderId}' in parents and name = '${escape("active.json")}' and trashed = false"
        val files = listFiles(token, query)
        val first = files.firstOrNull() ?: return InspectionResult.Empty(folderId)
        return try {
            val (content, etag) = readContent(token, first.id)
            InspectionResult.Exists(folderId, first.id, content, etag)
        } catch (e: DriveApiException) {
            InspectionResult.Unreadable(folderId, first.id, e.message ?: "Read failed")
        }
    }

    /**
     * Creates or updates the active.json file in Drive.
     *
     * @param ifMatch If set, sends `If-Match: <etag>` so Drive returns 412 when
     *                another device has pushed since our last read.
     * @return The Drive file id of the written file.
     */
    fun writeFile(
        folderId: String,
        content: String,
        existingFileId: String?,
        fileName: String,
        ifMatch: String?,
    ): String {
        val token = tokenManager.getAccessToken()
        return if (existingFileId != null) {
            patchFile(token, existingFileId, content, ifMatch)
        } else {
            createFile(token, folderId, fileName, content)
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private fun readContent(token: String, fileId: String): FileContent {
        val req = Request.Builder()
            .url("https://www.googleapis.com/drive/v3/files/$fileId?alt=media")
            .header("Authorization", "Bearer $token")
            .build()
        val resp = http.newCall(req).execute()
        val etag = resp.header("ETag")
        if (!resp.isSuccessful) throw DriveApiException(resp.message, resp.code)
        return FileContent(resp.body?.string() ?: "", etag)
    }

    private fun listFiles(token: String, query: String): List<DriveFile> {
        val q = URLEncoder.encode(query, "UTF-8")
        val req = Request.Builder()
            .url("https://www.googleapis.com/drive/v3/files?q=$q&fields=files(id,name)&pageSize=5")
            .header("Authorization", "Bearer $token")
            .build()
        val resp = http.newCall(req).execute()
        if (!resp.isSuccessful) throw DriveApiException(resp.message, resp.code)
        val json = JSONObject(resp.body?.string() ?: "{}")
        val arr = json.optJSONArray("files") ?: JSONArray()
        return (0 until arr.length()).map { i ->
            val f = arr.getJSONObject(i)
            DriveFile(f.getString("id"), f.getString("name"))
        }
    }

    private fun createFile(
        token: String,
        folderId: String,
        fileName: String,
        content: String,
    ): String {
        val boundary = "beancounter_boundary"
        val meta = JSONObject()
            .put("name", fileName)
            .put("parents", JSONArray().put(folderId))
            .put("mimeType", "application/json")
            .toString()
        val body = "--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
            meta + "\r\n--$boundary\r\nContent-Type: application/json\r\n\r\n" +
            content + "\r\n--$boundary--"
        val req = Request.Builder()
            .url("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
            .header("Authorization", "Bearer $token")
            .post(body.toRequestBody("multipart/related; boundary=$boundary".toMediaType()))
            .build()
        val resp = http.newCall(req).execute()
        if (!resp.isSuccessful) throw DriveApiException(resp.message, resp.code)
        return JSONObject(resp.body?.string() ?: "{}").getString("id")
    }

    private fun patchFile(
        token: String,
        fileId: String,
        content: String,
        ifMatch: String?,
    ): String {
        val reqBuilder = Request.Builder()
            .url("https://www.googleapis.com/upload/drive/v3/files/$fileId?uploadType=media")
            .header("Authorization", "Bearer $token")
            .patch(content.toRequestBody("application/json".toMediaType()))
        if (ifMatch != null) reqBuilder.header("If-Match", ifMatch)
        val resp = http.newCall(reqBuilder.build()).execute()
        if (!resp.isSuccessful) throw DriveApiException(resp.message, resp.code)
        return JSONObject(resp.body?.string() ?: "{}").getString("id")
    }

    private fun escape(s: String) = s.replace("\\", "\\\\").replace("'", "\\'")

    data class DriveFile(val id: String, val name: String)
}

/** Mirrors the PWA's `InspectionResult` discriminated union from `first-connect.ts`. */
sealed class InspectionResult {
    data class Empty(val folderId: String) : InspectionResult()
    data class Exists(
        val folderId: String,
        val fileId: String,
        val content: String,
        val etag: String?,
    ) : InspectionResult()
    data class Unreadable(
        val folderId: String,
        val fileId: String,
        val error: String,
    ) : InspectionResult()
}
