# Omarchy Mobile System Design

Status: Draft  
Last updated: 2026-09-08

## 1. Purpose

This document defines the proposed runtime architecture for Omarchy Mobile. It
covers component boundaries, state ownership, lifecycle, data flow, storage,
and failure handling. Cryptographic and message-level requirements are expanded
in the wire protocol and security specifications.

## 2. Design goals

- Preserve direct user ownership: no required account, relay, or hosted control
  plane.
- Make LAN interactions feel immediate.
- Keep authentication, authorization, and execution on the desktop even when
  the mobile UI has stale data.
- Support Expo without depending on the JavaScript runtime for operating-system
  background behavior.
- Provide an extensible capability model without executing downloaded code on
  mobile.
- Allow protocol evolution across independently updated desktop and mobile
  applications.
- Fail closed without losing understandable recovery paths.

## 2.1 Phase 1 simplification

The full architecture in this document supports the longer product direction.
Phase 1 follows [`mvp-priorities.md`](mvp-priorities.md) and uses a smaller
runtime:

- one phone and one desktop;
- foreground-only mobile operation;
- LAN discovery plus manual LAN address fallback;
- authenticated HTTPS request/response instead of a persistent control socket;
- a desktop CLI instead of a polished shell management panel;
- hard-coded typed operations instead of the dynamic capability provider system;
- one non-destructive proof action, `system.lock`.

Interfaces should permit later expansion, but Phase 1 must not implement unused
infrastructure solely because it appears in the full architecture.

## 3. High-level architecture

```text
                         Omarchy computer
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Omarchy shell plugin ───── local IPC ───── omarchy-linkd       │
│                                              │                  │
│  Capability providers ───── provider IPC ────┤                  │
│                                              │                  │
│  Wayland clipboard / files / media / system ─┘                  │
│                                              │                  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │ TLS 1.3
                                     LAN or tailnet route
                                               │
┌──────────────────────────────────────────────┼──────────────────┐
│  Native OmarchyLink module ──────────────────┘                  │
│       │ identity, discovery, connection, background transfer    │
│       │                                                         │
│  React Native application                                      │
│  Home · Tools · Inbox · Settings                                │
│                                                                 │
│  Share extension / intents · secure storage · notifications     │
└─────────────────────────────────────────────────────────────────┘
                         Mobile device
```

Optional remote infrastructure is defined in
[`cloud-infrastructure.md`](cloud-infrastructure.md). Direct LAN traffic does
not pass through the cloud. When enabled after Phase 1, both paired devices may
connect outward to a Cloudflare Durable Object that forwards end-to-end
encrypted frames. PlanetScale Postgres through Hyperdrive stores only durable
control-plane metadata; private R2 stores only client-encrypted offline objects.

## 4. Components

### 4.1 React Native application

Responsibilities:

- Navigation, screens, interaction, accessibility, and theme rendering.
- Cached presentation state for paired desktops and capability catalogs.
- User-visible validation and confirmation.
- Transfer and action progress presentation.
- Search, pinned tools, inbox management, and diagnostics.
- Calling typed APIs exposed by the OmarchyLink module.
- Supplying semantic view models to Expo UI's platform-native SwiftUI and
  Compose renderers defined in `native-design-system.md`.

It MUST NOT:

- Store long-term private keys in AsyncStorage or plain SQLite.
- Treat client-side permission or schema checks as authoritative.
- Maintain a supposedly permanent background connection in JavaScript.
- Execute markup or code received from a desktop.
- Construct shell commands.
- Choose raw Liquid Glass, Material, blur, shape, or animation implementation
  values at feature call sites.

### 4.2 OmarchyLink Expo module

Implemented in Swift and Kotlin behind a shared TypeScript interface.

Responsibilities:

- Generate and access platform-protected device identity.
- Discover `_omarchy._tcp` services and support manual endpoints.
- Establish authenticated sessions and apply certificate pinning.
- Serialize protocol I/O and expose typed events to React Native.
- Integrate with platform lifecycle and connectivity changes.
- Perform background-capable transfers where permitted.
- Coordinate iOS share-extension and Android intent payloads.
- Redact native diagnostics before they reach JavaScript.

Proposed TypeScript surface:

```ts
type ConnectionState =
  | { kind: "offline"; lastSeenAt?: string }
  | { kind: "discovering" }
  | { kind: "connecting"; route: "lan" | "tailnet" }
  | { kind: "online"; route: "lan" | "tailnet"; connectedAt: string }
  | { kind: "blocked"; reason: string };

interface OmarchyLinkModule {
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  createPairing(pairingUri: string): Promise<PairingResult>;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  revoke(deviceId: string): Promise<void>;
  request<T>(deviceId: string, request: ProtocolRequest): Promise<T>;
  startUpload(deviceId: string, source: NativeFileRef): Promise<Transfer>;
  cancelTransfer(transferId: string): Promise<void>;
}
```

The final interface SHOULD be generated from or checked against the protocol
schema to avoid Swift, Kotlin, Rust, and TypeScript drift.

### 4.2.1 OmarchyUI facade

UI rendering lives behind a local TypeScript design-system facade backed by
Expo UI (`@expo/ui`). This keeps visual code separate from identity, transport,
and authorization behavior without reimplementing native component bridges.

- iOS implementation uses `@expo/ui/swift-ui` and official Liquid Glass styles
  on supported releases, with native SwiftUI fallbacks on older releases.
- Android implementation uses `@expo/ui/jetpack-compose` and Material 3.
- Universal `@expo/ui` components are used when they preserve the intended
  platform-native behavior.
- React Native passes semantic state and receives typed user intents.
- Native renderers do not perform network requests or own business state.
- Custom Swift/Kotlin views are a documented fallback, not the default.

See [`native-design-system.md`](native-design-system.md) for the complete
component contract and P0 inventory.

### 4.3 Share integrations

#### iOS Share Extension

- A native Swift extension receives supported `NSItemProvider` values.
- The extension validates type, count, and preliminary size.
- If a safe background transfer can complete within extension limits, it MAY
  transfer directly through shared native code.
- Otherwise it stores a security-scoped handoff in an App Group container and
  opens or signals the main application using a supported system mechanism.
- Extension and main app share only the minimum queue metadata and payload.
- Successfully imported temporary payloads are deleted after transfer or expiry.

#### Android share intents

- An exported activity receives only declared `ACTION_SEND` and
  `ACTION_SEND_MULTIPLE` MIME types.
- URI permissions are temporary and copied into app-controlled storage only
  when necessary.
- The activity validates the sender-provided URI and never assumes the display
  name, size, or MIME type is trustworthy.

### 4.4 `omarchy-linkd`

A per-user Rust daemon managed by a systemd user unit.

Responsibilities:

- Own desktop identity, paired-device records, and revocation.
- Advertise the local service.
- Terminate TLS and authenticate every session.
- Negotiate protocol versions and features.
- Publish the authorized capability catalog.
- Validate, authorize, deduplicate, dispatch, and audit requests.
- Coordinate clipboard and inbox transfers.
- Maintain bounded action and transfer state.
- Expose local IPC to the Omarchy shell and capability providers.

It MUST run as the signed-in user, not root. Operations requiring privilege
elevation need a separate, explicit design and are not part of MVP.

### 4.5 Omarchy shell plugin

Responsibilities:

- Show daemon availability and connected-device count.
- Start pairing and display its QR code and expiry.
- Show pending pairing permissions and accept or reject the request.
- List, rename, and revoke paired mobile devices.
- Show recent redacted actions and transfers.
- Open troubleshooting information.

It communicates only over authenticated local IPC scoped to the current user.
Restarting the shell MUST NOT terminate sessions or erase pairing state.

### 4.6 Capability providers

A provider is a desktop component that registers one or more capabilities with
the daemon. Providers MAY be built in to the daemon or run out of process.

Out-of-process providers:

- Register through a local user-scoped Unix socket.
- Present a stable provider identifier and manifest.
- Receive only requests for their own registered capabilities.
- Return structured results and progress events.
- Are subject to daemon timeouts, output limits, and authorization.
- Cannot weaken the mobile device's granted permissions.

A command-backed provider uses an administrator-authored definition with an
executable path and typed argument mapping. It MUST invoke an argument vector
directly and MUST NOT concatenate or evaluate a shell command.

## 5. Desktop processes and local IPC

Proposed runtime paths follow XDG conventions:

```text
$XDG_RUNTIME_DIR/omarchy-link/daemon.sock
$XDG_RUNTIME_DIR/omarchy-link/inbox-staging/

$XDG_CONFIG_HOME/omarchy/mobile/config.toml
$XDG_CONFIG_HOME/omarchy/mobile/capabilities.d/

$XDG_DATA_HOME/omarchy/mobile/identity/
$XDG_DATA_HOME/omarchy/mobile/inbox/
$XDG_DATA_HOME/omarchy/mobile/state.db

$XDG_STATE_HOME/omarchy/mobile/log/
```

Exact paths remain provisional. Private keys MUST use mode `0600`; runtime
sockets and staging directories MUST be accessible only to the current user.

Local IPC operations:

- `status`
- `pairing.create`
- `pairing.cancel`
- `pairing.respond`
- `devices.list`
- `devices.rename`
- `devices.revoke`
- `capabilities.reload`
- `activity.list`
- `diagnostics.export`

The local IPC schema SHOULD reuse protocol types where appropriate but is not a
network-accessible administrative interface.

## 6. Data ownership

| Data | Authority | Mobile storage | Desktop storage |
|---|---|---|---|
| Device private identity | Each device | Keychain/Keystore | Restricted identity files |
| Pairing relationship | Both devices | Secure store + database reference | State database |
| Permissions | Desktop | Cached for display | Authoritative database |
| Capability catalog | Desktop | Cached SQLite | Providers + database metadata |
| Pinned actions | Mobile user | SQLite | Not required |
| Action execution | Desktop | Recent redacted mirror | Bounded redacted activity |
| Inbox payload | Receiving device | App files | User inbox directory |
| Transfer state | Both during transfer | SQLite | State database |
| Clipboard content | Clipboard owner | Never in history by default | Never in daemon history |

## 7. Persistence model

### 7.1 Mobile database

Suggested logical tables:

- `paired_devices`: public identity, name, endpoints, last seen, protocol info.
- `capability_cache`: desktop ID, catalog revision, serialized safe metadata.
- `pins`: desktop ID, capability ID, action ID, order.
- `activity`: request ID, type, redacted title, state, timestamps, expiry.
- `inbox_items`: local file reference, type, safe name, size, source, expiry.
- `transfers`: transfer ID, direction, progress, resume token, state.

Secrets are referenced by opaque secure-storage aliases, never stored in the
database.

### 7.2 Desktop database

SQLite is recommended for transactional state:

- paired device identities and revocation status;
- permission grants;
- catalog revisions;
- action idempotency records;
- transfer metadata;
- bounded redacted activity.

Inbox payloads remain ordinary files so users can inspect, move, and delete
their own data. Database rows reference generated paths.

## 8. Connection lifecycle

### 8.1 Foreground connection

1. Native module resolves known endpoints and discovery results.
2. It ranks direct LAN before tailnet endpoints unless user preference says
   otherwise.
3. It opens TLS, verifies pinned desktop identity, and authenticates the mobile
   identity.
4. Both sides negotiate protocol and feature versions.
5. Mobile fetches changed capability and permission revisions.
6. A heartbeat detects half-open connections.
7. Network changes trigger bounded reconnection with jitter.

### 8.2 Mobile suspension

- React Native persists presentation state before suspension when possible.
- The native layer closes or preserves the connection only as permitted by the
  operating system.
- The desktop treats an absent heartbeat as disconnected, not unpaired.
- On resume, mobile re-authenticates and reconciles requests and transfers by ID.
- iOS MUST NOT promise continuous presence after suspension.

### 8.3 Desktop restart

- Paired identities and permission grants survive restart.
- In-flight non-resumable actions become `outcome_unknown` unless the provider
  stored a terminal result.
- Resumable transfers negotiate remaining byte ranges.
- The mobile client refreshes revisions after reconnecting.

### 8.4 Optional Cloudflare relay

- Direct LAN remains the preferred route.
- A cloud-enabled desktop opens an outbound authenticated WebSocket to its
  per-relationship Durable Object.
- Mobile uses the same relay only when a direct route is unavailable or the user
  explicitly selects it.
- Worker and Durable Object validate an outer routing envelope but cannot
  decrypt the inner Omarchy protocol message.
- Remote action requests are forwarded only while the desktop is connected;
  they are never queued for later execution.
- Relay failure leaves local operation unaffected.

## 9. Request execution pipeline

```text
receive
  → authenticate session
  → validate envelope and size
  → check timestamp/replay window
  → resolve idempotency key
  → resolve current capability
  → authorize paired device
  → validate typed arguments
  → enforce rate and concurrency limits
  → require declared confirmation if applicable
  → dispatch provider
  → record redacted state
  → return result/event
```

No mobile or UI validation may be used to skip a desktop pipeline stage.

## 10. Clipboard design

Clipboard operations are commands, not continuous synchronization.

### Phone to desktop

1. User taps `Send clipboard` while the app is foregrounded.
2. Native clipboard API reads text after the gesture.
3. Mobile validates UTF-8 and byte size.
4. Text travels inside the encrypted request body.
5. Desktop validates again and supplies bytes to `wl-copy` through stdin.
6. Neither side logs, persists, hashes, or includes content in activity text.

### Desktop to phone

1. User explicitly requests desktop clipboard.
2. Desktop reads current text only after authorization.
3. Mobile receives it in memory and displays a preview policy that avoids
   exposing the full value in system snapshots where practical.
4. User chooses Copy; the native API writes to the platform clipboard.
5. Content is released after the flow completes.

MVP SHOULD retain the existing 64 KiB text limit used by the clipboard-sync
prototype unless testing justifies another value.

## 11. File-transfer design

- Control messages negotiate transfer metadata and a scoped transfer token.
- Payload bytes use HTTPS streaming rather than WebSocket JSON messages.
- Receivers write to a generated `.partial` path and atomically finalize after
  length and digest verification.
- Transfer tokens are single-purpose, expire quickly, and bind sender,
  receiver, direction, and transfer ID.
- Resumption uses verified byte ranges and a stable transfer ID.
- The receiver enforces free-space, count, total-size, and content-type policy.
- Original file mode, ownership, symlinks, and paths are discarded.
- A received filename is normalized for display and collision-safe storage.

## 12. Capability catalog lifecycle

- Daemon calculates a monotonically increasing catalog revision.
- Mobile requests a full catalog when no compatible cache exists.
- Later sessions may request changes after a known revision.
- Permission changes have a separate revision so revocation is not delayed by a
  stale catalog.
- Mobile invalidates pins whose stable IDs disappear and explains why.
- Provider failure marks its cards unavailable without breaking other tools.

## 13. Failure behavior

| Failure | Required behavior |
|---|---|
| Local-network permission denied | Explain where to restore permission; allow manual endpoint after permission is restored |
| Discovery blocked by network | Offer manual address and Tailscale guidance |
| Certificate mismatch | Stop connection; require explicit re-pairing; never silently trust new identity |
| Desktop sleeping/offline | Show last seen; queue nothing by default |
| Mobile app suspended | Reconcile on resume; do not report continuous connection |
| Provider timeout | Cancel when possible and return a typed timeout |
| Connection lost during action | Reconcile by request ID; show `outcome unknown` when truth is unavailable |
| Transfer interrupted | Preserve verified partial bytes only within retention policy; offer resume |
| Capability schema unsupported | Render an unsupported card and keep the rest of the catalog usable |
| Storage full | Reject before transfer when known; safely remove failed staging data |

## 14. Observability

Local diagnostics MAY include:

- versions and negotiated features;
- redacted device identifiers;
- route type and connection transitions;
- operation type, duration, state, and typed error code;
- byte counts and MIME category;
- provider availability and timeout counts.

They MUST NOT include:

- clipboard values;
- filenames unless the user explicitly includes them in a support export;
- file bytes or content-derived hashes in general logs;
- pairing tokens, keys, certificates, authorization headers, or transfer URLs;
- arbitrary provider stdout/stderr.

## 15. Packaging and updates

- `omarchy-linkd` ships through an Omarchy-supported package or explicit plugin
  installation path.
- The daemon systemd user unit starts on demand and MAY remain active while a
  paired relationship exists.
- Mobile ships as an Expo/React Native native binary through platform stores or
  an explicitly documented self-build path.
- JavaScript updates MUST NOT change native protocol or security behavior beyond
  the compatibility declared by the installed binary.
- Protocol compatibility must span at least one previous stable minor version.

## 16. Alternatives considered

### KDE Connect as the permanent transport

It offers proven discovery and pairing and remains useful for compatibility.
It does not directly provide the owner-defined mobile capability contract or
the intended Omarchy-native application model. The existing plugin can coexist
during migration.

### Pure React Native networking

Suitable for foreground prototypes but insufficient as the lifecycle authority
for discovery, background transfer, secure identities, and Android services.
The native OmarchyLink module is the stable boundary.

### Fully native mobile clients

Provides direct platform access but duplicates most product and design work.
Expo with explicit native modules preserves access without requiring two full
applications.

### Required public relay

Improves reachability and push delivery but conflicts with local-first MVP
scope and introduces identity, abuse, retention, and operating cost. It remains
a separate opt-in design if direct routes prove insufficient.
