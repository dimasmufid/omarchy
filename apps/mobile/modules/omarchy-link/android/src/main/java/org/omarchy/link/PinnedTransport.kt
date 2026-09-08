package org.omarchy.link

import android.content.Context
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.URL
import java.security.SecureRandom
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager

object PinnedTransport {
  fun execute(context: Context, optionsJson: String, upload: Boolean): String {
    val options = RequestOptions.fromJson(optionsJson)
    val url = URL(options.url)
    require(url.protocol == "https") { "Only HTTPS Omarchy endpoints are supported" }
    val connection = url.openConnection() as HttpsURLConnection
    val tls = SSLContext.getInstance("TLSv1.3")
    tls.init(
      null,
      arrayOf<TrustManager>(PinningTrustManager(options.fingerprint)),
      SecureRandom()
    )
    connection.sslSocketFactory = tls.socketFactory
    connection.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, _ -> true }
    configure(connection, options, upload)
    return performRequest(context, connection, options, upload)
  }

  private fun configure(connection: HttpsURLConnection, options: RequestOptions, upload: Boolean) {
    connection.instanceFollowRedirects = false
    connection.useCaches = false
    connection.connectTimeout = options.timeoutMs
    connection.readTimeout = if (upload) 300_000 else options.timeoutMs
    connection.requestMethod = options.method
    options.headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }
  }

  private fun performRequest(
    context: Context,
    connection: HttpsURLConnection,
    options: RequestOptions,
    upload: Boolean
  ): String {
    try {
      if (upload) {
        writeUpload(context, connection, options)
      } else if (options.body != null) {
        val bytes = options.body.toByteArray(Charsets.UTF_8)
        connection.doOutput = true
        connection.setFixedLengthStreamingMode(bytes.size)
        connection.outputStream.use { it.write(bytes) }
      }
      val status = connection.responseCode
      val input = if (status >= 400) connection.errorStream else connection.inputStream
      val body = input?.use(::readUtf8Limited) ?: ""
      return responseJson(status, connection.headerFields, body)
    } finally {
      connection.disconnect()
    }
  }

  private fun writeUpload(
    context: Context,
    connection: HttpsURLConnection,
    options: RequestOptions
  ) {
    val uri = Uri.parse(requireNotNull(options.fileUri) { "An upload requires fileUri" })
    val length = options.headers.entries
      .firstOrNull { it.key.equals("content-length", ignoreCase = true) }
      ?.value
      ?.toLongOrNull()
      ?: throw IllegalArgumentException("An upload requires Content-Length")
    require(length in 0..MAX_FILE_BYTES) { "The file exceeds the 25 MiB limit" }

    val input = context.contentResolver.openInputStream(uri)
      ?: throw IllegalArgumentException("The selected file cannot be opened")
    connection.doOutput = true
    connection.setFixedLengthStreamingMode(length)
    input.use { source ->
      connection.outputStream.use { target ->
        val copied = source.copyTo(target, BUFFER_BYTES)
        require(copied == length) { "The selected file changed before upload" }
      }
    }
  }

  private fun readUtf8Limited(input: InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(BUFFER_BYTES)
    var total = 0
    while (true) {
      val count = input.read(buffer)
      if (count < 0) break
      total += count
      require(total <= MAX_RESPONSE_BYTES) { "The desktop response is too large" }
      output.write(buffer, 0, count)
    }
    return output.toString(Charsets.UTF_8.name())
  }

  private const val BUFFER_BYTES = 64 * 1024
  private const val MAX_RESPONSE_BYTES = 256 * 1024
  private const val MAX_FILE_BYTES = 25L * 1024L * 1024L
}
