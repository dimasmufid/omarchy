import ExpoModulesCore
import Foundation

public final class OmarchyLinkModule: Module {
  private var discovery: BonjourDiscovery?

  public func definition() -> ModuleDefinition {
    Name("OmarchyLink")
    Events("onUploadProgress")

    AsyncFunction("requestAsync") { (optionsJson: String, promise: Promise) in
      PinnedTransport.execute(optionsJson, upload: false, promise: promise)
    }

    AsyncFunction("uploadAsync") { (optionsJson: String, promise: Promise) in
      PinnedTransport.execute(
        optionsJson,
        upload: true,
        promise: promise,
        onUploadProgress: { [weak self] uploadId, sent, total in
          self?.sendEvent("onUploadProgress", [
            "uploadId": uploadId,
            "sentBytes": sent,
            "totalBytes": total,
          ])
        }
      )
    }

    AsyncFunction("cancelUploadAsync") { (uploadId: String) in
      PinnedTransport.cancelUpload(uploadId)
    }

    AsyncFunction("discoverAsync") { (timeoutMs: Double, promise: Promise) in
      DispatchQueue.main.async {
        let discovery = BonjourDiscovery(promise: promise)
        self.discovery = discovery
        discovery.start(timeoutMs: timeoutMs)
      }
    }
  }
}
