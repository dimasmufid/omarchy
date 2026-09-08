# Omarchy Mobile Security and Privacy Specification

Status: Draft; production release requires independent review  
Last updated: 2026-09-08

## 1. Security objective

A paired phone receives narrowly scoped access to one user's Omarchy session.
The system protects content and actions from unpaired network peers, limits the
damage of a lost paired phone, makes consequential behavior visible, and keeps
the user's private data out of logs and required third-party infrastructure.

Pairing a phone is a meaningful trust decision. The product must explain that a
paired device may read status, transfer selected content, and invoke exactly the
capabilities granted to it.

## 2. Trust boundaries

```text
Untrusted local/tailnet network
        │
        ▼
TLS listener ── authenticated paired identity
        │
        ▼
omarchy-linkd ── authorization and schema boundary
        │
        ├── built-in system adapters
        ├── owner-authored command definitions
        └── third-party local capability providers

Mobile share sources ── untrusted URI/type/name/size
        │
        ▼
native share integration ── validation and bounded staging
        │
        ▼
OmarchyLink transfer layer
```

Optional cloud adds this boundary:

```text
paired endpoint ── application ciphertext ── Worker / Durable Object
                                                │
                                      routing metadata only
                                                │
                                      PlanetScale / R2 / Queues
```

Cloudflare and PlanetScale are trusted for availability, routing enforcement,
and durable metadata integrity. They are not trusted with plaintext clipboard,
file, or action payloads. See
[`cloud-infrastructure.md`](cloud-infrastructure.md).

The following remain untrusted even after pairing:

- device display names;
- network addresses and discovery records;
- capability-provider output;
- mobile action arguments;
- shared file names, MIME types, paths, and sizes;
- cached catalogs and permissions;
- clocks and timestamps supplied by a peer.

## 3. Protected assets

Highest sensitivity:

- long-term private device identities;
- pairing tokens and temporary transfer credentials;
- clipboard content;
- inbox payloads;
- capability arguments and results that may contain personal data;
- authorization and revocation state.

Integrity-critical assets:

- capability definitions and executable mappings;
- permission grants;
- action identity, arguments, confirmation, and result state;
- update artifacts and release signing identities.

Availability-sensitive assets:

- daemon and native connection service;
- local inbox storage;
- idempotency and transfer-resumption state.

## 4. Threat actors

- An unpaired device on the same LAN.
- A hostile or compromised Wi-Fi access point.
- A malicious tailnet peer.
- A thief holding a paired but locked or unlocked phone.
- A malicious mobile application sending crafted share content.
- A buggy or malicious desktop capability provider.
- A local desktop process running as the same user.
- A compromised desktop or mobile operating system.

The MVP does not claim to protect a user from a fully compromised device or
from malicious code already running with the same desktop user's privileges.
It still minimizes secrets, validates boundaries, and supports revocation.

## 5. Threats and required mitigations

| Threat | Required mitigation |
|---|---|
| Passive network observation | TLS 1.3 for every network request and transfer |
| Active man-in-the-middle during pairing | QR-pinned desktop identity plus high-entropy single-use token |
| Unauthorized pairing | Explicit desktop approval with device and permission display |
| Discovery spoofing | Treat DNS-SD as endpoint hint only; verify pinned identity |
| Stolen pairing QR | Five-minute maximum expiry, single use, desktop approval |
| Replay of an action | Session binding, timestamp window, unique ID, persistent idempotency record |
| Duplicate execution after timeout | Reconciliation and `outcome_unknown`; never blind retry non-idempotent work |
| Permission escalation by stale UI | Desktop checks authoritative current grants for every request |
| Capability UI spoofing | Fixed client chrome, semantic icons, plain text, no provider-rendered code |
| Shell injection | No arbitrary shell; direct argv execution; typed bounded inputs |
| Malicious filename/path traversal | Generated storage ID, normalized display name, discard supplied path/mode |
| Symlink or special-file transfer | Stream bytes into newly created regular file; reject unsupported source type |
| Disk exhaustion | Preflight quotas, streaming limits, reserved free-space threshold, cleanup |
| Clipboard leakage in logs | Sensitive type propagation and content-free logs/tests |
| Lost paired phone | Device-scoped grants, immediate desktop revocation, optional biometric gate |
| Compromised provider | Provider-scoped IPC, time/output limits, explicit permissions, no daemon secrets |
| Denial of service | Message-size, connection, rate, queue, CPU, and transfer concurrency limits |
| Downgrade | Authenticated version negotiation and minimum supported security version |
| Malicious update | Signed store releases; signed desktop packages; documented release provenance |
| Cloud operator or database disclosure | Application-layer E2EE; metadata minimization; no payload keys in cloud systems |
| Cross-link relay routing | One Durable Object per random relationship; authenticated role and destination checks |
| Offline object disclosure | Encrypt before R2 upload; short grants and expiry; content key only through E2EE channel |

## 6. Identity storage

### Mobile

- Use iOS Keychain and Android Keystore through a native module.
- Prefer hardware-backed, non-exportable keys when supported.
- Store database references to key aliases, never key bytes.
- Device migration must not silently copy a non-exportable identity to another
  physical phone. A restored app may require re-pairing.
- A fresh app sandbox clears any secure-store pairing record that survived an
  uninstall, so reinstalling the mobile app requires explicit re-pairing.
- Biometric access control MAY protect high-risk actions, but recovery behavior
  and accessibility must be designed before it becomes mandatory.

### Desktop

- Store identity under the user's XDG data directory with `0600` files and
  `0700` directories.
- Refuse to start network service if key files are broadly readable.
- Never place identity keys in shell configuration, environment variables,
  command arguments, or journal messages.
- Backups of identity material are an explicit future decision; automatic cloud
  backup is forbidden.

## 7. Authentication and pairing

- Use audited TLS and certificate libraries.
- Do not implement custom encryption, signatures, or key derivation.
- At least 256 bits of CSPRNG entropy is required for a pairing token.
- Token comparison must not introduce an avoidable timing oracle.
- Pairing attempts are rate-limited and bound to the active window.
- The desktop approval names the phone, platform, requested permissions, and
  route. Device names are escaped plain text.
- Mobile shows the desktop name and a short identity verification value.
- Desktop approval creates only memory-resident pending state. Pairing success
  and permission grants are committed transactionally after the phone proves it
  received the approved credential.
- Partial pairing state is removed on timeout, rejection, or crash recovery.

## 8. Authorization

Authorization uses default deny.

- Grants are per mobile identity, desktop, capability, and operation.
- Status-read and action-execute grants are distinct.
- New provider capabilities and permissions default to denied.
- Destructive actions require an action-bound short-lived confirmation.
- The desktop re-checks authorization immediately before dispatch.
- Revocation closes active sessions and removes outstanding transfer tokens.
- An offline queued action is not supported in MVP.
- Privileged root actions are not supported in MVP.

The desktop UI must provide `Allow once`, `Allow while paired`, and `Deny`
semantics only where each can be enforced correctly. MVP may use only persistent
per-capability grants plus action confirmations to avoid misleading choices.

## 9. Content handling

### Clipboard

- Read only after a user gesture.
- Keep only in process memory for the operation.
- Never include in activity history, logs, notifications, crash reports, or
  analytics.
- Never use a content hash as an identifier in general telemetry.
- Apply strict type and size limits on sender and receiver.

### Files and inbox

- Treat supplied metadata as untrusted.
- Store under generated identifiers outside executable search paths.
- Default received files to non-executable permissions.
- Verify declared length and negotiated digest before finalization.
- Scan integration MAY be added, but the app must not label a file safe merely
  because a scanner is absent or returned no finding.
- Automatic opening or execution is forbidden.
- Retention expiry safely removes both payload and metadata.

### URLs

- Display normalized host and scheme before opening when source is remote.
- Permit only explicit supported schemes.
- Never turn received text into an automatically opened URL.

## 10. Local data retention

Proposed defaults:

| Data | Default retention |
|---|---|
| Pairing and grants | Until revoked |
| Pairing token | Five minutes or first use |
| Idempotency terminal record | Seven days; minimum protocol guarantee 24 hours |
| Redacted activity | Thirty days or 500 entries, whichever comes first |
| Failed transfer staging | Twenty-four hours maximum |
| Inbox content | Until user deletion; revisit before release |
| Diagnostics bundle | Created only on request and not retained by daemon |

The final inbox default is an open product decision. Every retention limit must
be configurable downward, and `Clear activity` must not affect pairing.

## 11. Logging and telemetry

### Allowed local fields

- timestamp;
- application and protocol versions;
- operation category and stable non-content error code;
- truncated or session-scoped device reference;
- route category;
- duration, byte count, and state;
- provider ID when needed for diagnosis.

### Forbidden fields

- clipboard or file content;
- pairing URI, token, key, certificate, cookie, or authorization value;
- full persistent device identity;
- original filename by default;
- arbitrary action arguments or results;
- provider stdout/stderr;
- full network addresses in routine logs.

There is no default remote telemetry. Any future analytics upload requires:

- separate opt-in;
- a published event schema;
- local preview of collected fields;
- a deletion and disable path;
- no payload-derived values;
- no requirement for core operation.

The optional Cloudflare service may retain the minimum operational metadata
documented in `cloud-infrastructure.md`; enabling relay must disclose that
Cloudflare can observe timing, ciphertext sizes, network metadata, and routing
relationships even though payload content remains encrypted.

## 12. Mobile platform privacy

- Permission prompts occur in context and explain the immediate benefit.
- Local-network permission is requested only when discovery begins.
- Photo library broad access is avoided in favor of system pickers.
- Notifications are optional and not required for foreground LAN controls.
- Clipboard content is read only after explicit intent.
- Background Android connection mode has a persistent visible notification.
- iOS does not claim continuous listening while suspended.

## 13. Dependency and supply-chain policy

- Prefer platform and well-maintained ecosystem libraries.
- Pin Rust, npm, CocoaPods, and Gradle dependencies through lockfiles.
- Review libraries that touch networking, crypto, credentials, native build
  configuration, or updates.
- Generate an SBOM for release artifacts.
- Scan dependencies and container/build images in CI.
- Never download executable capability code from a paired desktop.
- Expo over-the-air updates, if enabled, require code signing and a documented
  rollback policy; they cannot modify native permission boundaries.

## 14. Security verification gates

Before public beta:

- Pairing and session design reviewed by a cryptography/security engineer.
- Threat-model review covers LAN, tailnet, lost-device, provider, and share-input
  attacks.
- Protocol parser fuzzing runs for Rust and native boundary decoders.
- Authorization tests prove every action fails after revocation.
- Injection tests cover all command-backed argument types.
- Transfer tests cover traversal, symlink, oversized, truncated, digest-failed,
  no-space, and cancellation cases.
- Logs and crash artifacts pass automated forbidden-field scanning.
- Mobile storage inspection confirms secrets are absent from plain storage and
  backups where configured.
- External penetration test is strongly recommended before remote access or a
  relay is offered.

## 15. Incident response requirements

- A user can revoke one or all phones locally on the desktop.
- A mobile user can forget a desktop and delete local inbox/history data.
- A security release can raise the minimum accepted protocol version.
- Compromised release keys and pairing identities have documented rotation
  procedures before launch.
- Diagnostics export states exactly what it contains before sharing.
- Security contact and responsible disclosure instructions ship with the public
  repository and store listings.

## 16. Unresolved security decisions

1. Concrete certificate issuance, rotation, and revocation representation.
2. Whether mobile private keys require user-presence hardware protection.
3. Whether desktop inbox content is encrypted at rest by the application or
   relies on the user's disk encryption.
4. Default inbox retention.
5. Optional relay threat model and metadata exposure.
6. Store and non-store release signing and reproducibility requirements.
