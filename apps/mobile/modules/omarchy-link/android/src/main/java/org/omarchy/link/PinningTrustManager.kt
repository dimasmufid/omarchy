package org.omarchy.link

import android.util.Base64
import java.security.MessageDigest
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager

class PinningTrustManager(fingerprint: String) : X509TrustManager {
  private val expectedFingerprint: ByteArray = decodeFingerprint(fingerprint)

  override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {
    throw CertificateException("Client certificates are not accepted")
  }

  override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
    val certificate = chain?.firstOrNull() ?: throw CertificateException("No server certificate")
    certificate.checkValidity()
    val actual = MessageDigest.getInstance("SHA-256").digest(certificate.encoded)
    if (!MessageDigest.isEqual(actual, expectedFingerprint)) {
      throw CertificateException("The desktop identity does not match the pairing code")
    }
  }

  override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()

  private fun decodeFingerprint(value: String): ByteArray {
    val decoded = try {
      Base64.decode(value, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    } catch (error: IllegalArgumentException) {
      throw IllegalArgumentException("The desktop certificate fingerprint is invalid", error)
    }
    if (decoded.size != 32) {
      throw IllegalArgumentException("The desktop certificate fingerprint must be SHA-256")
    }
    return decoded
  }
}
