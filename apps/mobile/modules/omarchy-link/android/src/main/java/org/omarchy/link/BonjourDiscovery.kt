package org.omarchy.link

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

object BonjourDiscovery {
  @Suppress("DEPRECATION")
  suspend fun discover(context: Context, timeoutMs: Long): String {
    val manager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    val results = ConcurrentHashMap<String, JSONObject>()
    val listener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(serviceType: String) = Unit
      override fun onDiscoveryStopped(serviceType: String) = Unit
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
      override fun onServiceLost(service: NsdServiceInfo) {
        results.remove(service.serviceName)
      }

      override fun onServiceFound(service: NsdServiceInfo) {
        manager.resolveService(service, object : NsdManager.ResolveListener {
          override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) = Unit

          override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
            val id = serviceInfo.attributes["id"]?.toString(Charsets.UTF_8) ?: return
            val protocolVersion = serviceInfo.attributes["pv"]
              ?.toString(Charsets.UTF_8)
              ?.toIntOrNull() ?: 1
            val host = serviceInfo.host?.hostAddress ?: return
            results[serviceInfo.serviceName] = JSONObject()
              .put("id", id)
              .put("name", serviceInfo.serviceName)
              .put("host", host)
              .put("port", serviceInfo.port)
              .put("protocolVersion", protocolVersion)
          }
        })
      }
    }

    manager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
    try {
      delay(timeoutMs.coerceIn(250L, 5_000L))
    } finally {
      runCatching { manager.stopServiceDiscovery(listener) }
    }
    return JSONArray(results.values.sortedBy { it.getString("name") }).toString()
  }

  private const val SERVICE_TYPE = "_omarchy._tcp."
}
