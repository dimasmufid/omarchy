import ExpoModulesCore
import Foundation

enum PinnedTransport {
  private static let uploadsLock = NSLock()
  private nonisolated(unsafe) static var uploads: [String: URLSessionUploadTask] = [:]

  static func cancelUpload(_ uploadId: String) {
    uploadsLock.lock()
    let task = uploads[uploadId]
    uploadsLock.unlock()
    task?.cancel()
  }

  static func execute(
    _ optionsJson: String,
    upload: Bool,
    promise: Promise,
    onUploadProgress: ((String, Int64, Int64) -> Void)? = nil
  ) {
    do {
      let options = try JSONDecoder().decode(RequestOptions.self, from: Data(optionsJson.utf8))
      guard let url = URL(string: options.url), url.scheme == "https", let host = url.host else {
        throw OmarchyLinkError.invalidUrl
      }
      let delegate = try PinnedSessionDelegate(
        fingerprint: options.fingerprint,
        expectedHost: host,
        uploadProgress: { sent, total in
          if let uploadId = options.uploadId {
            onUploadProgress?(uploadId, sent, total)
          }
        }
      )
      let configuration = URLSessionConfiguration.ephemeral
      configuration.timeoutIntervalForRequest = (options.timeoutMs ?? 15_000) / 1_000
      configuration.timeoutIntervalForResource = upload ? 300 : 30
      configuration.tlsMinimumSupportedProtocolVersion = .TLSv13
      configuration.urlCache = nil
      configuration.httpCookieStorage = nil
      let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
      var request = URLRequest(url: url)
      request.httpMethod = options.method
      options.headers?.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
      if let body = options.body {
        request.httpBody = Data(body.utf8)
      }

      let completion: (Data?, URLResponse?, Error?) -> Void = { data, response, error in
        if let uploadId = options.uploadId {
          uploadsLock.lock()
          uploads.removeValue(forKey: uploadId)
          uploadsLock.unlock()
        }
        defer { session.finishTasksAndInvalidate() }
        if let error {
          promise.reject(error)
          return
        }
        guard let response = response as? HTTPURLResponse else {
          promise.reject(OmarchyLinkError.missingResponse)
          return
        }
        let data = data ?? Data()
        guard data.count <= 256 * 1024 else {
          promise.reject(OmarchyLinkError.responseTooLarge)
          return
        }
        let headers = response.allHeaderFields.reduce(into: [String: String]()) { output, item in
          output[String(describing: item.key).lowercased()] = String(describing: item.value)
        }
        let payload = TransportResponse(
          status: response.statusCode,
          headers: headers,
          body: String(data: data, encoding: .utf8) ?? ""
        )
        do {
          let encoded = try JSONEncoder().encode(payload)
          promise.resolve(String(decoding: encoded, as: UTF8.self))
        } catch {
          promise.reject(error)
        }
      }

      if upload {
        guard let value = options.fileUri,
              let fileUrl = URL(string: value),
              fileUrl.isFileURL
        else {
          throw OmarchyLinkError.unsupportedFileUrl
        }
        guard let uploadId = options.uploadId, !uploadId.isEmpty else {
          throw OmarchyLinkError.invalidUploadId
        }
        let task = session.uploadTask(with: request, fromFile: fileUrl, completionHandler: completion)
        uploadsLock.lock()
        uploads[uploadId] = task
        uploadsLock.unlock()
        task.resume()
      } else {
        session.dataTask(with: request, completionHandler: completion).resume()
      }
    } catch {
      promise.reject(error)
    }
  }
}
