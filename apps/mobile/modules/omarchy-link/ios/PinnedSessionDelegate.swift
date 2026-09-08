import CryptoKit
import Foundation

final class PinnedSessionDelegate: NSObject, URLSessionTaskDelegate {
  private let expectedFingerprint: Data
  private let expectedHost: String
  private let uploadProgress: ((Int64, Int64) -> Void)?

  init(
    fingerprint: String,
    expectedHost: String,
    uploadProgress: ((Int64, Int64) -> Void)? = nil
  ) throws {
    guard let decoded = Self.decodeBase64Url(fingerprint), decoded.count == 32 else {
      throw OmarchyLinkError.invalidFingerprint
    }
    expectedFingerprint = decoded
    self.expectedHost = expectedHost
    self.uploadProgress = uploadProgress
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didSendBodyData bytesSent: Int64,
    totalBytesSent: Int64,
    totalBytesExpectedToSend: Int64
  ) {
    uploadProgress?(totalBytesSent, totalBytesExpectedToSend)
  }

  func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
          let trust = challenge.protectionSpace.serverTrust,
          let certificate = SecTrustGetCertificateAtIndex(trust, 0)
    else {
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    let certificateData = SecCertificateCopyData(certificate) as Data
    let actual = Data(SHA256.hash(data: certificateData))
    guard Self.constantTimeEqual(actual, expectedFingerprint) else {
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(request.url?.host == expectedHost ? request : nil)
  }

  private static func decodeBase64Url(_ value: String) -> Data? {
    var base64 = value.replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    base64.append(String(repeating: "=", count: (4 - base64.count % 4) % 4))
    return Data(base64Encoded: base64)
  }

  private static func constantTimeEqual(_ left: Data, _ right: Data) -> Bool {
    guard left.count == right.count else { return false }
    return zip(left, right).reduce(UInt8(0)) { result, bytes in
      result | (bytes.0 ^ bytes.1)
    } == 0
  }
}
