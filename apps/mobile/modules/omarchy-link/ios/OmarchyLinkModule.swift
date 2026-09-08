import ExpoModulesCore
import Foundation

public final class OmarchyLinkModule: Module {
  private var discovery: BonjourDiscovery?

  public func definition() -> ModuleDefinition {
    Name("OmarchyLink")

    AsyncFunction("requestAsync") { (optionsJson: String, promise: Promise) in
      PinnedTransport.execute(optionsJson, upload: false, promise: promise)
    }

    AsyncFunction("uploadAsync") { (optionsJson: String, promise: Promise) in
      PinnedTransport.execute(optionsJson, upload: true, promise: promise)
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
