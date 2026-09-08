# Omarchy Mobile Delivery and Verification Plan

Status: Draft  
Last updated: 2026-09-08

## 1. Delivery strategy

Build the smallest end-to-end vertical slice that tests the risky boundaries
before investing in the full interface. A polished Home screen is not evidence
that discovery, pairing, native lifecycle, or authorization will work.

Each milestone ends with a runnable demonstration, automated evidence, updated
specifications, and an explicit go/no-go decision.

The authoritative Phase 1 cut and build order are defined in
[`mvp-priorities.md`](mvp-priorities.md). For Phase 1, M0 through the relevant
parts of M3 are required, plus only the hard-coded `system.lock` slice from M4.
The general capability catalog, shell management panel, multiple devices,
Tailscale, and background connection work remain P1 or P2.

## 2. Proposed repository structure

```text
apps/
├── mobile/                         # Expo React Native application
│   ├── app/                        # routes
│   ├── src/                        # features, UI, state, protocol client
│   ├── modules/omarchy-link/       # local Swift/Kotlin Expo module
│   ├── extensions/ios-share/       # native share extension source
│   ├── plugins/                    # Expo config plugins
│   └── e2e/
│
└── shell-plugin/                   # Omarchy shell pairing/device UI

crates/
├── omarchy-linkd/                  # Rust per-user daemon
├── omarchy-link-protocol/          # Rust protocol types and validation
└── omarchy-link-provider-sdk/      # local provider IPC SDK

packages/
├── protocol-schema/                # canonical schemas and fixtures
├── protocol-typescript/            # generated TS types/client primitives
├── capability-components/          # mobile renderers for safe contract
└── design-system/                  # mobile tokens and components

providers/
├── system/
├── media/
├── clipboard/
├── inbox/
└── launcher/

ai/specs/                           # product and engineering source of truth
docs/                               # user/developer documentation
fixtures/protocol/                  # cross-language conformance transcripts
```

The final repository may remain a monorepo or split release artifacts later.
Schemas and conformance fixtures should remain shared even if runtime code is
separated.

## 3. Milestones

### M0: Decisions and threat review

Goal: remove architectural ambiguity before implementation.

Deliverables:

- Resolve the open decisions in the specs that affect the first spike.
- Choose supported OS floors and initial desktop package target.
- Select maintained TLS/mTLS, DNS-SD, WebSocket, and SQLite libraries.
- Write the concrete certificate profile and key-rotation proposal.
- Define canonical JSON schemas and sensitive-field annotations.
- Create a top-level threat model review record.

Exit criteria:

- No production code relies on an undecided cryptographic construction.
- Desktop and mobile owners agree on generated/shared protocol types.
- Initial capability list and transfer-size limits are chosen.

### M1: Native feasibility spike

Goal: prove Expo is not the constraint and identify platform constraints early.

Demonstration:

1. Rust daemon advertises itself on LAN.
2. Expo development build discovers it using the local OmarchyLink module.
3. Mobile scans a QR and establishes a pinned encrypted test session.
4. Mobile invokes a hard-coded, non-destructive `ping` capability.
5. iOS Share Extension and Android share intent each receive text and deliver it
   to the foreground application.
6. A test file transfers with cancellation and integrity verification.

Exit criteria:

- Demonstration passes on at least one physical iPhone and Android phone.
- No secret or shared content appears in logs.
- Clean Expo prebuild reproduces required native targets and declarations.
- Known background behavior is recorded, not inferred.

### M2: Trusted device foundation

Goal: create a durable, revocable pairing relationship.

Deliverables:

- Desktop pairing UI and expiring QR.
- Mobile pairing flow and permission request.
- Secure identity persistence.
- Mutual session authentication.
- Paired-device management and immediate revocation.
- Version negotiation, heartbeat, reconnect, and typed errors.
- Security-focused unit, integration, and parser tests.

Exit criteria:

- Pair, reject, expire, reconnect, revoke, identity mismatch, and reinstall flows
  pass on both platforms.
- Revoked devices cannot call any endpoint or resume a transfer.
- Pairing survives normal application and daemon upgrades.

### M3: Continuity vertical slice

Goal: deliver the smallest product with daily value.

Deliverables:

- Home connection card.
- Explicit clipboard push and pull.
- Phone share surface for text, URLs, one image, and one file.
- Desktop and mobile inbox receipt.
- Transfer progress, cancellation, retry, and bounded local activity.
- Cleanup and retention behavior.

Exit criteria:

- All continuity acceptance scenarios pass across Wi-Fi/Ethernet and tailnet
  test routes.
- Clipboard content never persists outside the receiving system clipboard.
- Failed and interrupted transfers leave no finalized corrupt files.
- Product copy distinguishes accepted from completed delivery.

### M4: Safe control deck

Goal: prove remote actions are useful without becoming remote shell access.

Deliverables:

- Capability catalog and fixed component renderer.
- System lock, media, volume, appearance/focus, and registered launch actions.
- Per-device permissions.
- Desktop-owned confirmation challenges.
- Pins, search, offline states, idempotency, and reconciliation.

Exit criteria:

- Every request is denied when its grant is removed, regardless of cached UI.
- Duplicate network submission cannot duplicate a non-idempotent action.
- Unknown components and provider failure do not break Tools.
- Screen-reader and large-text passes cover every component.

### M5: Owner-defined capability preview

Goal: validate the product's central extensibility thesis.

Deliverables:

- Local TOML capability definitions.
- Direct argv command runner with typed mappings.
- Provider registration IPC and one reference provider SDK.
- Desktop UI to inspect, enable, grant, and disable owner tools.
- Developer documentation and example capabilities.

Exit criteria:

- Injection and environment-isolation test suite passes.
- New permissions default to denied.
- Removing a provider disables its actions immediately.
- A user can create a safe action from documentation without changing mobile
  code.

### M6: Private beta and store readiness

Goal: validate reliability, trust, and onboarding outside the development team.

Deliverables:

- Onboarding, troubleshooting, diagnostics export, and privacy disclosures.
- Signed desktop packages and mobile builds.
- Crash reporting decision and opt-in implementation if approved.
- Accessibility, localization-readiness, battery, and network testing.
- Incident response and release rollback runbooks.

Exit criteria:

- Public-beta reliability targets in the PRD are met during a defined soak.
- Independent security review findings are fixed or explicitly accepted.
- Store privacy labels match actual application behavior.
- No P0/P1 defects remain open.

## 4. Test strategy

### 4.1 Schema and contract tests

- Validate every message and capability fixture against canonical schemas.
- Generate invalid fixtures for missing, extra, malformed, oversized, and
  unsupported fields.
- Confirm TypeScript, Swift, Kotlin, and Rust interpret canonical fixtures
  equivalently.
- Snapshot only non-sensitive sanitized representations.

### 4.2 Unit tests

Mobile shared code:

- state transitions;
- catalog compatibility and rendering selection;
- pin invalidation;
- error-to-copy mapping;
- redaction;
- retention selection;
- input validation.

Native modules:

- URI and QR parsing;
- secure-storage alias lifecycle;
- discovery record validation;
- share payload validation;
- file staging and cleanup;
- lifecycle event translation.

Rust daemon:

- authorization matrix;
- confirmation binding;
- idempotency and reconciliation;
- rate/concurrency limiting;
- provider lifecycle;
- filename normalization and file finalization;
- retention and revocation transactions.

### 4.3 Integration tests

- Real daemon plus mobile protocol client on loopback/LAN.
- Pairing approval and rejection through shell local IPC.
- Certificate mismatch and rotated identities.
- Capability catalog revisions and permission changes.
- Action accepted/progress/completed/failed sequences.
- Clipboard adapter with isolated fake `wl-copy` and `wl-paste`.
- Transfer interruption, range resume, checksum failure, and cancellation.
- Provider timeout, crash, malformed response, and restart.

### 4.4 Security tests

- Protocol parser fuzzing.
- Property tests for IDs, sizes, and normalized inputs.
- Replay and duplicate-request simulation.
- Authorization checks across every message type.
- Path traversal, symlink, special file, oversized stream, and disk-full tests.
- Shell metacharacters in every owner-defined argument type.
- Automated scan of logs, traces, crash reports, and fixtures for canary secrets.
- Revocation races during action and transfer execution.

### 4.5 Mobile UI tests

- Pairing happy path and every terminal error.
- Home online, reconnecting, offline, permission-blocked, and mismatch states.
- Share flow with valid, unsupported, oversized, and revoked targets.
- Confirmation and idempotent retry behavior.
- Dynamic type/font scale, screen reader, reduced motion, high contrast, and
  color-blind-safe state communication.
- Small phone, large phone, and tablet layout smoke tests.

### 4.6 Physical and network tests

Use the matrix in `platform-behavior.md`, plus:

- desktop lock/unlock, suspend/resume, logout/login, daemon restart, and reboot;
- phone lock/unlock, background/foreground, force-quit, reboot, and reinstall;
- router reconnect, IP change, Wi-Fi/mobile transition, packet loss, and latency;
- concurrent paired phones and permission differences;
- network with mDNS blocked but direct address reachable;
- tailnet route with LAN unavailable.

## 5. Required end-to-end scenarios

Each release candidate records artifacts for these scenarios:

1. Fresh install to successful local pairing.
2. Rejected and expired pairing.
3. Reconnect after both devices restart.
4. Send phone clipboard to desktop and verify absence from logs/history.
5. Pull desktop clipboard after explicit request and copy on phone.
6. Share text, URL, image, and file from another mobile application.
7. Interrupt and resume a file transfer.
8. Invoke each built-in action with allowed and denied devices.
9. Disconnect during a non-idempotent action and reconcile the outcome.
10. Revoke the active phone and prove all further access fails.
11. Load an invalid capability provider without affecting valid tools.
12. Clear activity and inbox content while preserving pairing.

## 6. Quality gates

### Pull request

- Formatting, lint, type checking, unit tests, schema validation.
- No generated protocol drift.
- Dependency and secret scanning.
- Clean Expo prebuild verification when native configuration changes.
- Rust unsafe-code and dependency policy checks as selected by the team.

### Merge to main

- Cross-language conformance suite.
- Desktop integration suite.
- Android emulator and iOS simulator UI smoke tests.
- Build signed internal artifacts.

### Release candidate

- Physical-device matrix.
- Required end-to-end scenarios.
- Upgrade and rollback from previous supported release.
- Battery, memory, storage, and local-network measurements.
- Security gate completion and forbidden-field log audit.
- Manual UX/accessibility review.

## 7. Severity and release policy

| Severity | Meaning | Release rule |
|---|---|---|
| P0 | Secret/content exposure, unauthorized execution, destructive corruption | Stop release; revoke affected build if shipped |
| P1 | Pairing/auth bypass, reliable crash in core flow, unrecoverable transfer loss | Stop release |
| P2 | Major feature failure with recovery or platform-specific serious defect | Explicit owner decision required |
| P3 | Minor behavior, polish, or diagnostics issue | May ship with tracking |

Any uncertainty about whether an action executed after a disconnect is a product
state, not merely an internal error, and must be shown as `Outcome unknown`.

## 8. Packaging and releases

Desktop:

- Package daemon, user service, shell plugin, and built-in providers with signed
  provenance.
- Installation does not edit packaged Omarchy files in place.
- User capabilities live in user configuration and survive upgrades.
- Database migrations are forward-tested and backed up before destructive shape
  changes.

Mobile:

- Produce internal development builds, beta-channel builds, then store builds.
- Runtime version binds JavaScript bundles to compatible native capability sets.
- Release notes disclose permission or background-behavior changes.
- Store privacy declarations are generated from an owner-reviewed checklist,
  not assumptions.

## 9. Documentation required for public beta

- Product overview and trust model.
- Pairing guide.
- iOS and Android platform behavior guide.
- LAN, firewall, guest Wi-Fi, and Tailscale troubleshooting.
- Paired-device and permission management.
- Inbox retention and deletion.
- Owner-defined capability tutorial and schema reference.
- Protocol compatibility policy.
- Diagnostics and support bundle contents.
- Security reporting policy.
- Uninstall and complete data-removal instructions.

## 10. Decision log template

Material decisions should be recorded in `ai/specs/decisions/NNNN-title.md`:

```markdown
# NNNN: Decision title

Status: Proposed | Accepted | Replaced
Date: YYYY-MM-DD

## Context

## Decision

## Consequences

## Alternatives considered
```

Initial decisions to record before M1:

- WebSocket/TLS versus HTTP/2 or QUIC.
- Certificate and device identity lifecycle.
- Expo CNG/native project ownership policy.
- File transfer resumption protocol.
- Supported iOS and Android versions.
- Optional remote-notification relay boundary.

## 11. Definition of MVP done

MVP is done only when:

- users can pair and revoke a phone;
- direct LAN and configured tailnet sessions authenticate correctly;
- clipboard and supported share items complete end to end;
- safe built-in capabilities enforce device-scoped permissions;
- failures and platform lifecycle are represented honestly;
- required security, accessibility, physical-device, and network tests pass;
- secrets and payload content are absent from logs and default telemetry;
- user and developer documentation reflects actual shipped behavior;
- an upgrade path exists for independently versioned mobile and desktop builds.
