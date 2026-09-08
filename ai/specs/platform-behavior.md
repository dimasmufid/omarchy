# Omarchy Mobile Platform Behavior

Status: Draft  
Last updated: 2026-09-08

## 1. Purpose

This document converts iOS and Android operating-system constraints into
required product behavior. React Native and Expo do not remove these platform
rules. Platform-specific work lives behind native Swift and Kotlin modules or
extensions while the shared application presents consistent concepts.

Every behavior must be verified on currently supported OS versions and physical
devices before release. Simulator success is insufficient for discovery,
background work, clipboard, notifications, or share extensions.

## 2. Support proposal

- iOS and iPadOS: current major and previous two major releases at public launch.
- Android: API floor to be chosen after dependency and device research; target
  the current Play requirement.
- Form factors: phones first; tablets use adaptive layouts but are not a separate
  MVP experience.
- Expo Go is not a supported runtime. Development and production use custom
  development/production builds.

Exact versions must be locked when implementation starts and reviewed before
each store release.

## 3. Capability matrix

| Capability | iOS | Android | Product requirement |
|---|---|---|---|
| Foreground LAN connection | Supported | Supported | Primary MVP path |
| DNS-SD discovery | Bonjour with local-network permission | NSD/mDNS subject to network and permission behavior | Manual address fallback |
| Permanent background socket | Not generally available | Possible with foreground service and visible notification | Never required for core MVP |
| Scheduled background work | System-decided and deferrable | WorkManager, system-decided | No precise timing claims |
| Clipboard read/write | User-intent and privacy constrained | Foreground/privacy constrained | Explicit button or share flow |
| Receive shared content | Share Extension | Share intents | Native validation boundary |
| Background large transfer | Background URLSession where applicable | WorkManager/foreground service depending urgency | Post-MVP unless spike validates MVP need |
| Notifications while app is closed | Requires local scheduling or APNs for remote events | Local/push; background limits apply | Optional relay is separate scope |
| Secure keys | Keychain/Secure Enclave where available | Keystore/hardware backing where available | Native module |
| Widgets/live surfaces | Native extension | App widgets | Post-MVP |

## 4. Common lifecycle states

The shared UI models:

- `foreground_online`
- `foreground_connecting`
- `foreground_offline`
- `background_limited`
- `route_unavailable`
- `permission_blocked`
- `desktop_sleeping`
- `identity_mismatch`

Copy must describe observed state, not imply that the phone is continuously
connected while suspended.

Examples:

- Good: `Last connected 8 minutes ago. Open the app to reconnect.`
- Bad: `Always connected` on iOS.
- Good: `Waiting for Android to run the scheduled sync.`
- Bad: `Syncing in exactly 15 minutes.`

## 5. iOS design

### 5.1 Native targets

- Main React Native/Expo application.
- Share Extension written in Swift.
- Optional Widget Extension only after MVP.
- Shared framework or Swift package for identity, protocol, transfer, and
  validated App Group queue access.

Extension entitlements and App Group identifiers are managed by an Expo config
plugin and validated in CI after prebuild.

### 5.2 Local-network discovery

- Request local-network access when the user begins computer discovery, not on
  unrelated first launch.
- Declare only the Bonjour service types actually used.
- If permission is denied, show Settings recovery and manual route explanation.
- A Share Extension must not initiate first-time local-network permission; the
  main app completes setup first.
- Discovery success does not establish identity. TLS pinning remains required.

### 5.3 Clipboard

- Read the general pasteboard only after `Send clipboard`, Paste, or another
  unambiguous user gesture.
- Do not poll pasteboard changes in the background.
- Prefer system paste controls where they improve privacy behavior.
- Write received content only after an explicit Copy action unless verified OS
  behavior and user expectation justify an immediate write.
- Avoid full clipboard previews in notification text and app-switcher snapshots.

### 5.4 Share Extension

- Accept only declared text, URL, image, and file representations.
- Limit item count and size before copying.
- Use `NSItemProvider` asynchronously and respect extension time/memory limits.
- Store handoff content only in the configured App Group container.
- Use generated filenames and a small transactional queue record.
- If the main app must open, state that clearly rather than displaying a false
  background success.
- Clean abandoned extension payloads on next launch and by maximum expiry.

### 5.5 Background behavior

- Do not maintain product correctness through JavaScript timers.
- Treat scheduled background tasks as opportunistic refresh only.
- Use native background URLSession for eligible transfers after a dedicated
  lifecycle spike.
- When the user force-quits, assume background work and connections will not
  resume until relaunch.
- Desktop-originated closed-app notifications require APNs, which implies an
  optional relay or user-controlled push bridge not included in local-only MVP.

### 5.6 Secure storage

- Device identity and peer credentials use Keychain access controls.
- Share Extension receives only the credentials it needs through an appropriate
  shared access group; do not expose all app secrets automatically.
- Evaluate Secure Enclave-backed identity during the security spike.
- App backup/restore behavior must be tested; restored pairing must not become
  valid on an unintended physical device.

## 6. Android design

### 6.1 Native components

- Main React Native/Expo activity.
- Share-intent receiving activity.
- Kotlin OmarchyLink module.
- Optional bound/foreground connection service.
- WorkManager workers for deferrable cleanup and eligible transfer work.
- App widgets only after MVP.

Manifest services, intent filters, network configuration, and permissions are
generated through tested Expo config plugins.

### 6.2 Discovery and networking

- Use Android NSD or a maintained native mDNS implementation.
- Observe multicast and nearby-device permission behavior on supported API
  levels; request only permissions actually required.
- Listen for connectivity changes and rebuild the route instead of assuming a
  socket survives Wi-Fi/mobile transitions.
- Support manual endpoint entry and tailnet IP/name.
- Account for vendor battery policies in diagnostics without instructing users
  to disable protections unless a feature truly requires it.

### 6.3 Clipboard

- Read clipboard only while foregrounded following a user action.
- Do not use accessibility services, a deceptive input method, root, or ADB to
  bypass clipboard restrictions.
- Write received clipboard text only through documented platform APIs and show
  confirmation when system behavior requires it.
- Treat manufacturer-specific behavior as a test matrix, not a guarantee.

### 6.4 Share intents

- Declare a minimal supported MIME set.
- Validate `content://` URIs and temporary permission grants.
- Never trust `_data` paths or require broad storage permission.
- Stream or copy from `ContentResolver` under explicit limits.
- Handle single and multiple share separately; MVP MAY cap to one large item.

### 6.5 Background behavior

- Foreground connection mode is optional and explicitly enabled.
- A foreground service always has an honest persistent notification and a Stop
  action.
- Service types and permissions are declared according to the target API.
- Do not start a foreground service from a prohibited background state.
- Use WorkManager for deferrable cleanup, retry, and transfer work.
- Reconcile after process death because no service is immortal.
- Core commands remain available by opening the app even when background mode
  is disabled.

### 6.6 Secure storage

- Generate or wrap identity with Android Keystore.
- Prefer hardware-backed keys and StrongBox where available without excluding
  otherwise supported devices.
- Test device-lock changes, biometric enrollment changes, backup/restore, and
  application reinstall behavior.
- Do not put secrets in SharedPreferences, AsyncStorage, logs, intents, or
  notification extras.

## 7. Expo project policy

### 7.1 Build mode

- Use `expo-dev-client` development builds from the first native spike.
- Use Continuous Native Generation with deterministic config plugins.
- Native module code lives in a local Expo module or versioned workspace package.
- Never validate native functionality only in Expo Go.

### 7.2 Native configuration

Config plugins own:

- iOS usage descriptions, Bonjour declarations, App Groups, and extension
  targets;
- Android permissions, service declarations, intent filters, and network
  security configuration;
- platform build settings needed by the OmarchyLink module.

CI regenerates native projects from a clean checkout and fails on unexpected
diffs or missing declarations.

### 7.3 Over-the-air updates

If Expo Updates is enabled:

- updates are cryptographically signed;
- runtime versions prevent JS from expecting absent native capabilities;
- security-sensitive native behavior is never assumed to change through JS
  alone;
- the app supports rollback to the last known compatible bundle;
- the feature remains optional and documented in the ownership model.

## 8. UX differences that should remain platform-native

- Permission prompts and Settings recovery instructions.
- Share Extension and Android share-intent presentation.
- Clipboard paste controls.
- Back navigation, menus, and system sheets.
- Biometric authentication.
- Notifications and persistent Android service controls.
- File and photo pickers.

The Omarchy visual system remains coherent, but it must not erase platform
expectations or accessibility behavior.

## 9. Physical-device verification matrix

At minimum, test:

- current and oldest supported iPhone OS versions;
- one current flagship and one older iPhone;
- Pixel/reference Android on oldest and current supported API;
- Samsung current release;
- one vendor with aggressive background process management;
- Wi-Fi phone to Ethernet desktop;
- Wi-Fi phone to Wi-Fi desktop;
- guest/client-isolated Wi-Fi failure;
- IPv4-only, IPv6-enabled, and tailnet routes;
- app foreground, background, force-quit, device locked, and device rebooted;
- permission granted, denied, later revoked, and restored.

## 10. Platform spikes required before MVP commitment

1. iOS Share Extension receives each supported item type and hands it off without
   leaking or orphaning temporary content.
2. Bonjour/NSD discovery reliably finds the Rust daemon across target networks.
3. Mutual authentication and secure identity storage survive normal upgrades but
   fail safely after reinstall or incompatible restore.
4. Foreground clipboard flows behave honestly on target OS versions.
5. A 100 MB test transfer handles suspension, network change, cancellation, and
   resumption according to documented platform behavior.
6. Android foreground connection mode survives expected lifecycle events with a
   clear notification and battery impact measurement.

