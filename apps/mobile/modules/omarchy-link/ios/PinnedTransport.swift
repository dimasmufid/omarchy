import ExpoModulesCore
import Foundation

enum PinnedTransport {
  static func execute(_ optionsJson: String, upload: Bool, promise: Promise) {
    do {
      let options = try JSONDecoder().decode(RequestOptions.self, from: Data(optionsJson.utf8))
      guard let url = URL(string: options.url), url.scheme == "https", let host = url.host else {
        throw OmarchyLinkError.invalidUrl
      }
      let delegate = try PinnedSessionDelegate(
        fingerprint: options.fingerprint,
        expectedHost: host
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
        session.uploadTask(with: request, fromFile: fileUrl, completionHandler: completion).resume()
      } else {
        session.dataTask(with: request, completionHandler: completion).resume()
      }
    } catch {
      promise.reject(error)
    }
  }
}
