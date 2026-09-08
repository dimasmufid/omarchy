package org.omarchy.link

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.HttpsURLConnection

private class ActiveUpload {
  val cancelled = AtomicBoolean(false)
  @Volatile var connection: HttpsURLConnection? = null

  fun cancel() {
    cancelled.set(true)
    connection?.disconnect()
  }
}

class OmarchyLinkModule : Module() {
  private val activeUploads = ConcurrentHashMap<String, ActiveUpload>()

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("OmarchyLink")
    Events("onUploadProgress")

    AsyncFunction("requestAsync") Coroutine { optionsJson: String ->
      withContext(Dispatchers.IO) { PinnedTransport.execute(context, optionsJson, false) }
    }

    AsyncFunction("uploadAsync") Coroutine { optionsJson: String ->
      val uploadId = RequestOptions.fromJson(optionsJson).uploadId
        ?.takeIf(String::isNotEmpty)
        ?: throw IllegalArgumentException("An upload requires uploadId")
      val upload = ActiveUpload()
      check(activeUploads.putIfAbsent(uploadId, upload) == null) { "Upload is already active" }
      try {
        withContext(Dispatchers.IO) {
          PinnedTransport.execute(
            context,
            optionsJson,
            true,
            onConnection = { connection ->
              upload.connection = connection
              if (upload.cancelled.get()) connection.disconnect()
            },
            onProgress = { sent, total ->
              sendEvent("onUploadProgress", mapOf(
                "uploadId" to uploadId,
                "sentBytes" to sent.toDouble(),
                "totalBytes" to total.toDouble()
              ))
            },
            isCancelled = upload.cancelled::get
          )
        }
      } finally {
        activeUploads.remove(uploadId, upload)
      }
    }

    AsyncFunction("cancelUploadAsync") { uploadId: String ->
      activeUploads[uploadId]?.cancel()
    }

    AsyncFunction("discoverAsync") Coroutine { timeoutMs: Double ->
      BonjourDiscovery.discover(context, timeoutMs.toLong())
    }
  }
}
