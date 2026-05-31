# Keep NanoHTTPD so its reflection-based routing works after minification.
-keep class fi.iki.elonen.** { *; }

# OkHttp + Okio
-dontwarn okhttp3.**
-dontwarn okio.**
