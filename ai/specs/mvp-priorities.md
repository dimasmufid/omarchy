# Omarchy Mobile MVP Priorities

Status: Proposed Phase 1 scope  
Product shape: Omarchy Drop  
Last updated: 2026-09-08

## 1. Phase 1 in one sentence

Pair one phone with one Omarchy computer on the same local network, then move
text, links, and one file between the phone and desktop with an explicit action;
also provide one safe remote action, Lock, to prove the future control model.

This document is the authoritative MVP cut. Broader requirements elsewhere in
`ai/specs` describe the product direction and are not automatically Phase 1.

## 2. Why this is the right first product

Phase 1 must prove only four uncertain things:

1. Expo can host the native discovery, identity, sharing, and transport code.
2. Pairing can be local, understandable, and secure without an account.
3. Cross-device sharing is useful enough to become a daily habit.
4. A typed mobile request can safely trigger an Omarchy action.

Everything else should wait until these are demonstrated on physical devices.

The MVP is not yet a platform. It is a small companion application with a
protocol that can later become a platform.

## 3. Priority definitions

| Priority | Meaning |
|---|---|
| **P0** | Required to call Phase 1 complete |
| **P1** | Next release after users validate the Phase 1 loop |
| **P2** | Strategic product direction; do not build before P1 evidence |
| **Excluded** | Conflicts with the product or creates unacceptable risk |

Security, privacy, accessibility, and truthful error states are release gates,
not lower-priority features.

## 4. P0: build this

### 4.1 Supported topology

- One mobile device paired with one Omarchy desktop.
- One user account on the desktop.
- Same reachable LAN only.
- Foreground operation only.
- One operation or transfer at a time.
- One shared item per send.

The code may use stable IDs that permit multiple devices later, but Phase 1 UI,
testing, and product behavior do not manage multiple devices.

### 4.2 Mobile screens

#### Pairing

- Explain that the phone and desktop must be on the same network.
- Scan a QR code produced by the desktop.
- Show the desktop name and wait for desktop confirmation.
- Show distinct rejected, expired, unreachable, and identity-error states.

#### Home

- Desktop name and `Online`, `Connecting`, or `Offline` state.
- `Send clipboard`.
- `Get desktop clipboard`.
- `Send a file`.
- `Lock desktop`.
- A compact last-operation result.
- Settings button.

No tabs, dashboard widgets, graphs, plugin cards, or command palette are needed.

#### Send confirmation

- Target desktop.
- Safe content category, filename when applicable, and size.
- Progress for a file.
- Cancel, success, and typed failure.

Clipboard content is not previewed by default.

#### Settings

- Paired desktop identity and last-seen time.
- Local-network permission recovery.
- Forget desktop.
- Privacy summary and sanitized diagnostics.

### 4.3 Mobile share surface

- Accept one text item, URL, image, or file from the system share menu.
- Validate type and size.
- Bring the main app forward when required by the platform.
- Let the user explicitly send to the paired desktop.
- Never promise silent background delivery.

If robust iOS extension transfer is not ready, the acceptable Phase 1 behavior
is: capture the item, open Omarchy Mobile, then require Send. It is not acceptable
to report success before the desktop confirms final receipt.

### 4.4 Desktop components

- `omarchy-linkd` Rust user daemon.
- `omarchy-mobile` CLI for setup and device management.
- Desktop notification when an item arrives.
- Inbox directory owned by the user.
- Clipboard adapter using Wayland tools through stdin/stdout without logging
  content.
- Lock adapter using an existing supported Omarchy command or session API.

The CLI is enough for Phase 1:

```text
omarchy-mobile pair       # displays QR and waits for approval
omarchy-mobile status
omarchy-mobile revoke
omarchy-mobile inbox      # opens or prints inbox location
```

A polished Omarchy shell panel is P1. This prevents desktop UI work from
blocking validation of the mobile product.

### 4.5 Transport and protocol

- QR-pinned TLS pairing with a single-use expiring token.
- Authenticated HTTPS request/response after pairing.
- JSON control bodies with strict schemas and size limits.
- Streaming HTTPS upload for the single file.
- Direct request result: no event stream, presence subscription, or persistent
  WebSocket in Phase 1.
- Manual LAN address fallback when discovery fails.

Using request/response keeps mobile lifecycle honest and removes reconnection,
heartbeats, server events, and background socket complexity. WebSocket events
remain compatible future work.

### 4.6 Phase 1 operations

| Operation | Direction | Limit | Completion truth |
|---|---|---:|---|
| Send clipboard text | Phone → desktop | 64 KiB UTF-8 | Desktop successfully writes clipboard |
| Get clipboard text | Desktop → phone | 64 KiB UTF-8 | Phone receives; user explicitly copies |
| Share text or URL | Phone → desktop | 64 KiB UTF-8 | Desktop stores inbox item |
| Share one image/file | Phone → desktop | 25 MiB | Desktop verifies and finalizes file |
| Lock desktop | Phone → desktop | No arguments | Desktop accepts the lock request |
| Status | Desktop → phone | Metadata only | Current request succeeds |

The 25 MiB file limit is a conservative Phase 1 default and may change after
physical-device transfer testing.

## 5. P0 acceptance criteria

Phase 1 is complete when all of these are true:

- A fresh physical phone pairs with a physical Omarchy desktop in under one
  minute on a normal LAN.
- Pairing requires confirmation on the desktop and survives normal restarts.
- A revoked phone cannot use any endpoint.
- Phone clipboard text becomes the desktop clipboard after one explicit send.
- Desktop clipboard text can be requested and explicitly copied on the phone.
- Text, URL, image, and file share flows work from at least two source apps.
- A completed file has verified size and digest and cannot escape the inbox.
- Lock works once per tap and duplicate requests do not cause duplicate work.
- Offline, permission denied, expired pairing, oversized content, disk full, and
  interrupted transfer have clear recovery behavior.
- No clipboard value, file content, pairing token, credential, or transfer URL
  appears in logs or crash output.
- The chosen first mobile platform passes all flows on a physical device.

## 6. P1: build only after Phase 1 is used

P1 expands the validated loop without changing the product into a platform yet:

- Support the second mobile platform if Phase 1 launched on only one.
- Pair multiple phones and select among multiple desktops.
- Add a minimal Omarchy shell panel for pairing, presence, and revocation.
- Add desktop-to-mobile file and text delivery while the app is foregrounded.
- Support Tailscale routes.
- Add resumable transfers and a higher configurable size limit.
- Add media play/pause and volume.
- Add a small, redacted activity history.
- Synchronize the Omarchy accent theme.
- Add Android opt-in foreground connection mode if user demand justifies it.

## 7. P2: platform direction

- Declarative capability catalog and Tools screen.
- Owner-defined command capabilities.
- Provider SDK and third-party integrations.
- Pinned actions and command search.
- Optional relay and closed-app push notifications.
- Widgets, Live Activities, and richer system surfaces.
- Automation triggers and completion notifications.
- Rich clipboard types and history.
- Remote approval workflows.

Do not design Phase 1 screens around empty placeholders for these features.

## 8. Excluded

- Arbitrary shell terminal or SSH console.
- Full remote desktop.
- Silent background clipboard monitoring.
- Required Omarchy account or public cloud.
- Automatic file opening or execution.
- Root or package-management actions.
- A web view that renders desktop-provided UI or code.
- Location tracking, accessibility-service workarounds, or clipboard restriction
  bypasses.

## 9. Recommended platform sequence

For a solo developer, launch Phase 1 on the phone platform used personally every
day. Daily dogfooding is worth more than theoretical simultaneous coverage.

If there is no personal-platform preference, use this order:

1. Android physical-device spike, because its service and share surfaces are
   generally more permissive for companion workflows.
2. Keep the React Native product layer platform-neutral.
3. Add iOS after request/response, foreground-only behavior is stable.

If the developer's daily phone is an iPhone, reverse the order. Do not build two
native integration layers concurrently during the first spike.

## 10. Build order

### Slice 1: insecure local proof, never released

- Rust `/status` endpoint.
- Expo development build discovers the desktop.
- Phone renders desktop name and latency.

This may use temporary development credentials only on an isolated development
network. Remove the insecure path before Slice 2 completes.

### Slice 2: trust foundation

- Device identities.
- QR pairing and desktop confirmation.
- Pinned authenticated requests.
- Revocation.

No user content is transferred until this slice passes security tests.

### Slice 3: clipboard loop

- Send phone clipboard.
- Get desktop clipboard.
- Sensitive-data redaction tests.

This is the first internally useful build.

### Slice 4: share and file

- Mobile share input.
- Single-item upload.
- Inbox finalization, notification, and cleanup.
- Physical interruption and disk-full tests.

### Slice 5: one control

- Hard-coded typed `system.lock` action.
- Desktop authorization.
- Idempotency and duplicate-tap protection.

### Slice 6: polish and beta gate

- Final Home and Settings states.
- Accessibility and physical-device matrix.
- Packaging, upgrade, diagnostics, and user documentation.

## 11. Explicit stop conditions

Pause expansion and fix the foundation if:

- pairing is unreliable on normal home networks;
- the user cannot understand whether a send completed;
- content or secrets appear in logs;
- the share flow regularly requires more effort than an existing alternative;
- platform lifecycle causes corrupt or falsely successful transfers;
- Lock or another action can execute twice after a retry;
- the architecture requires a public relay for same-LAN use.

Do not respond to these failures by adding more features.

## 12. Questions to resolve before implementation

Only three product choices are required before Slice 1:

1. Which personally owned phone platform is first?
2. What desktop inbox directory should received items use by default?
3. Should the Phase 1 CLI be a standalone `omarchy-mobile` binary first, or be
   wired into the `omarchy mobile ...` command family immediately?

