import ExpoModulesCore
import Foundation

final class BonjourDiscovery: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
  private let browser = NetServiceBrowser()
  private var services: [NetService] = []
  private var results: [String: DiscoveredDesktop] = [:]
  private let promise: Promise
  private var finished = false

  init(promise: Promise) {
    self.promise = promise
    super.init()
    browser.delegate = self
  }

  func start(timeoutMs: Double) {
    browser.searchForServices(ofType: "_omarchy._tcp.", inDomain: "local.")
    DispatchQueue.main.asyncAfter(deadline: .now() + max(0.25, timeoutMs / 1_000)) { [weak self] in
      self?.finish()
    }
  }

  func netServiceBrowser(
    _ browser: NetServiceBrowser,
    didFind service: NetService,
    moreComing: Bool
  ) {
    services.append(service)
    service.delegate = self
    service.resolve(withTimeout: 1.0)
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    guard let host = sender.hostName?.trimmingCharacters(in: CharacterSet(charactersIn: ".")) else {
      return
    }
    let txt = NetService.dictionary(fromTXTRecord: sender.txtRecordData() ?? Data())
    let id = txt["id"].flatMap { String(data: $0, encoding: .utf8) } ?? sender.name
    let version = txt["pv"]
      .flatMap { String(data: $0, encoding: .utf8) }
      .flatMap(Int.init) ?? 1
    results[id] = DiscoveredDesktop(
      id: id,
      name: sender.name,
      host: host,
      port: sender.port,
      protocolVersion: version
    )
  }

  private func finish() {
    guard !finished else { return }
    finished = true
    browser.stop()
    do {
      let encoded = try JSONEncoder().encode(Array(results.values))
      promise.resolve(String(decoding: encoded, as: UTF8.self))
    } catch {
      promise.reject(error)
    }
  }
}
