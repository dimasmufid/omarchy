package org.omarchy.link

import org.json.JSONObject

data class RequestOptions(
  val url: String,
  val method: String,
  val fingerprint: String,
  val headers: Map<String, String>,
  val body: String?,
  val timeoutMs: Int,
  val fileUri: String?,
  val uploadId: String?
) {
  companion object {
    fun fromJson(value: String): RequestOptions {
      val json = JSONObject(value)
      val headersObject = json.optJSONObject("headers") ?: JSONObject()
      val headers = headersObject.keys().asSequence().associateWith { key ->
        headersObject.getString(key)
      }
      return RequestOptions(
        url = json.getString("url"),
        method = json.getString("method"),
        fingerprint = json.getString("fingerprint"),
        headers = headers,
        body = json.optString("body").takeIf { json.has("body") && !json.isNull("body") },
        timeoutMs = json.optInt("timeoutMs", 15_000).coerceIn(1_000, 300_000),
        fileUri = json.optString("fileUri").takeIf { json.has("fileUri") && !json.isNull("fileUri") },
        uploadId = json.optString("uploadId").takeIf { json.has("uploadId") && !json.isNull("uploadId") }
      )
    }
  }
}

fun responseJson(status: Int, headers: Map<String?, List<String>>, body: String): String {
  val outputHeaders = JSONObject()
  headers.forEach { (name, values) ->
    if (name != null) {
      outputHeaders.put(name.lowercase(), values.joinToString(", "))
    }
  }
  return JSONObject()
    .put("status", status)
    .put("headers", outputHeaders)
    .put("body", body)
    .toString()
}
