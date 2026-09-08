import Foundation

struct RequestOptions: Decodable {
  let url: String
  let method: String
  let fingerprint: String
  let headers: [String: String]?
  let body: String?
  let timeoutMs: Double?
  let fileUri: String?
  let uploadId: String?
}

struct TransportResponse: Encodable {
  let status: Int
  let headers: [String: String]
  let body: String
}

struct DiscoveredDesktop: Encodable {
  let id: String
  let name: String
  let host: String
  let port: Int
  let protocolVersion: Int
}

enum OmarchyLinkError: Error, LocalizedError {
  case invalidUrl
  case invalidFingerprint
  case missingResponse
  case responseTooLarge
  case unsupportedFileUrl
  case invalidUploadId

  var errorDescription: String? {
    switch self {
    case .invalidUrl: "The Omarchy desktop address is invalid."
    case .invalidFingerprint: "The desktop certificate fingerprint is invalid."
    case .missingResponse: "The Omarchy desktop returned no HTTP response."
    case .responseTooLarge: "The Omarchy desktop response exceeded 256 KiB."
    case .unsupportedFileUrl: "The selected file cannot be opened by Omarchy Mobile."
    case .invalidUploadId: "The file transfer identifier is invalid."
    }
  }
}
