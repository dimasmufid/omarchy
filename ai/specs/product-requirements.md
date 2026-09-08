# Omarchy Mobile Product Requirements

Status: Draft  
Target release: MVP  
Last updated: 2026-09-08

## 1. Product thesis

Omarchy Mobile is the pocket surface of the computer the user owns. It makes an
Omarchy computer continuous, reachable, and programmable from a phone while
preserving local control, understandable permissions, and honest platform
behavior.

The application is not a generic remote desktop, SSH client, system-monitoring
dashboard, or cloud account wrapper. Its primary value is completing small,
high-frequency cross-device jobs with less friction than opening a laptop or
manually moving information between devices.

## 2. Problem

An Omarchy user regularly moves between a computer and a phone, but their state
and actions are split across those devices. Existing tools tend to have one or
more of these problems:

- They require a third-party cloud account or public relay.
- They expose a generic technical interface instead of an Omarchy-native one.
- They optimize for remote administration rather than everyday continuity.
- They hide important security boundaries behind a single broad permission.
- They are fixed products rather than surfaces the owner can extend.
- They imply background behavior that iOS or Android cannot reliably provide.

## 3. Intended users

### 3.1 Primary user

An existing Omarchy user with one personal computer and one personal phone who
wants fast clipboard, sharing, and remote actions without surrendering control
to a required cloud service.

### 3.2 Secondary users

- An Omarchy power user who publishes their own scripts as safe mobile actions.
- A developer who wants completion notifications and controls for local tasks.
- A user with multiple Omarchy computers who wants to choose a target device.
- A plugin author who wants a small status card or action surface on mobile.

### 3.3 Explicitly unsupported users in MVP

- Teams administering fleets of other people's computers.
- Unattended server operators who require guaranteed remote execution.
- Users who cannot establish either a reachable LAN or a private routed network.

## 4. Jobs to be done

1. When I copy or discover something on one device, help me use it on the other
   with an explicit, short interaction.
2. When I am away from the keyboard, let me perform a small set of safe actions
   without exposing a general-purpose shell.
3. When work finishes or needs attention, tell me enough to decide what to do.
4. When I create a personal workflow, let me give it a useful mobile surface
   without building an entire mobile application.
5. When a device is lost or a permission becomes uncomfortable, let me revoke
   it immediately and understand what happened.

## 5. Product principles

### 5.1 Owned by the user

- No mandatory Omarchy account.
- Local communication and storage are the default.
- Remote routing is user-selected and replaceable.
- Data formats and capability definitions are documented.
- A paired phone receives only explicitly granted capabilities.

### 5.2 Intentional, not magical

- Sending sensitive content requires an understandable user action.
- Destructive actions require confirmation.
- The interface distinguishes requested, accepted, completed, and failed work.
- Platform restrictions are visible in product language.

### 5.3 Touch-native Omarchy

- Preserve Omarchy's calm, keyboard-oriented clarity without imitating a
  desktop window manager on a small screen.
- Prefer a few large, searchable actions over dense system controls.
- Use terminal language only for technical state, logs, and command results.
- Render interactive surfaces with Expo UI (`@expo/ui`): real SwiftUI and
  Liquid Glass where supported on iOS, and real Jetpack Compose with Material 3
  on Android.
- Share semantics and product identity across platforms, not identical pixels.

### 5.4 Extensible but constrained

- The desktop may publish new capabilities.
- Mobile renders only a reviewed set of declarative components.
- The desktop remains the authorization and execution authority.
- No downloaded JavaScript, QML, HTML, or executable plugin code runs on mobile.

## 6. Scope

The complete product direction below is prioritized in
[`mvp-priorities.md`](mvp-priorities.md). That document is authoritative for the
Phase 1 release cut. In particular, dynamic capabilities, multiple devices,
background presence, Tailscale, and a shell management panel are not Phase 1.

### 6.1 Product capabilities

#### Setup and trust — P0 foundation

- Discover an Omarchy computer on the local network.
- Pair by scanning a QR code displayed by the desktop.
- Display and confirm both device names during pairing.
- Assign initial permissions before completing pairing.
- Persist device trust in platform secure storage.
- Revoke a phone from either the desktop or phone.

#### Device home — P0 minimal state; broader actions P1/P2

- Show selected computer, reachability, current route, and last-seen time.
- Show quick actions supplied by the desktop.
- Show recent transfer and action activity without sensitive payload content.
- Support pull-to-refresh and a clear reconnect action.

#### Continuity — P0 phone-to-desktop; broader delivery P1

- Send foreground clipboard text from phone to desktop.
- Request current desktop clipboard text and copy it after explicit confirmation.
- Receive text, URL, image, and file content through the mobile share surface.
- Send selected text, URL, image, or file to the desktop inbox.
- Send text or a file from desktop to the mobile inbox while the app is open.
- Provide clear progress, cancellation, success, and failure states.

#### Safe controls — P0 Lock only; remaining controls P1

- Lock the desktop.
- Toggle desktop media play/pause.
- Change desktop media volume.
- Toggle an owner-configured focus/night-light action.
- Launch an allowlisted desktop application or URL.
- Confirm any action classified as destructive or privacy-sensitive.

#### Capability surfaces — P2

- Fetch the paired device's authorized capability catalog.
- Render built-in status rows, action buttons, toggles, progress, and grouped
  cards from the declarative capability contract.
- Search capabilities and pin selected actions to Home.
- Reject unknown or incompatible component types without breaking the screen.

### 6.2 Post-MVP candidates

- Multiple desktops with presence-aware switching.
- Android persistent connection mode with an explicit foreground notification.
- Optional Cloudflare live relay when no direct route exists.
- End-to-end encrypted offline delivery through private R2 storage.
- Optional push delivery processed through Cloudflare Queues.
- Widgets and iOS Live Activities.
- Resumable background uploads and downloads.
- Rich clipboard formats and clipboard history selection.
- Camera-to-desktop scanning workflows.
- Approval prompts on mobile for privileged desktop actions.
- Automation triggers based on network, time, location, or device presence.

### 6.3 Non-goals

- Full remote desktop or screen mirroring.
- A general SSH terminal as the primary experience.
- Arbitrary shell command submission from mobile.
- Silent continuous clipboard reading on iOS or modern Android.
- Circumventing background-execution or clipboard privacy restrictions.
- Required public cloud storage or a required Omarchy identity service.
- Allowing Cloudflare, PlanetScale, or an operator to decrypt relayed content.
- Administrative fleet management.
- Installing desktop packages or changing the firewall without desktop consent.
- Executing capability-provided code inside the mobile application.

## 7. Information architecture

The MVP has four primary destinations:

1. **Home**: selected computer, connection state, continuity shortcuts, pinned
   actions, and recent activity.
2. **Tools**: searchable built-in and owner-installed capability cards.
3. **Inbox**: received and sent items, transfer state, and explicit retention
   controls.
4. **Settings**: paired devices, permissions, routes, privacy, appearance, and
   diagnostics.

If only one computer is paired, the computer picker remains compact. The
interface must not force multi-device management complexity onto this default
case.

## 8. Primary flows

### 8.1 First pairing

1. Desktop user opens `Omarchy Mobile` setup and sees a QR code, expiry, and
   local device name.
2. Mobile user scans the code and sees the expected desktop identity.
3. Both devices establish an authenticated encrypted channel.
4. Mobile requests a baseline permission bundle.
5. Desktop shows the phone name and permissions and requires acceptance.
6. Both sides store the paired identity; the QR token becomes unusable.
7. Mobile enters Home and fetches the authorized capability catalog.

Acceptance:

- Typical same-LAN pairing completes in less than 30 seconds after scanning.
- Cancel, expiry, network loss, duplicate use, and rejection have distinct UI.
- A pairing is never saved before desktop acceptance completes.

### 8.2 Share from phone to desktop

1. User opens the system share surface from another application.
2. User selects Omarchy Mobile and, if necessary, a target desktop.
3. Extension validates type and size and hands the item to the main app or a
   permitted native background transfer.
4. Desktop stores the item in its inbox and returns an accepted result.
5. Mobile reports accepted separately from fully transferred or opened.

Acceptance:

- Text and URLs require at most two choices after selecting Omarchy Mobile.
- Payload content never appears in application logs or notification bodies.
- Failure preserves the source item and offers a safe retry.

### 8.3 Run a desktop action

1. User opens a pinned action or finds it in Tools.
2. Mobile validates inputs against the published schema.
3. High-risk actions show the target computer and consequences for confirmation.
4. Desktop re-authorizes the request and executes the registered handler.
5. Mobile displays accepted, running, completed, or failed state.

Acceptance:

- Repeated taps do not unintentionally execute the same action twice.
- Unknown, revoked, or changed actions fail closed.
- The desktop never interpolates mobile input into a shell command.

### 8.4 Revoke a lost phone

1. User opens paired devices on the desktop.
2. User selects the exact phone and chooses Revoke.
3. Desktop deletes authorization and rejects subsequent sessions immediately.
4. Other paired devices remain unaffected.

## 9. Functional requirements

Requirement keywords MUST, SHOULD, and MAY are normative.

### 9.1 Identity and pairing

- **FR-ID-001:** Each installation MUST generate a unique cryptographic device
  identity on first use.
- **FR-ID-002:** Private identity material MUST be non-exportable when supported
  by the platform and MUST use secure platform storage.
- **FR-ID-003:** Pairing MUST require explicit confirmation on the desktop.
- **FR-ID-004:** Pairing tokens MUST be single-use, high entropy, and expire in
  no more than five minutes.
- **FR-ID-005:** Revocation MUST take effect before the next request is executed.
- **FR-ID-006:** Renaming a device MUST NOT change its cryptographic identity.

### 9.2 Connectivity

- **FR-NET-001:** The client MUST support direct LAN connections.
- **FR-NET-002:** Discovery MUST degrade to manual address entry when multicast
  discovery is unavailable.
- **FR-NET-003:** Tailscale addresses MAY be used without changing the
  application protocol.
- **FR-NET-004:** The UI MUST distinguish local, tailnet, relayed, reconnecting,
  offline, and permission-blocked states when applicable.
- **FR-NET-005:** Requests MUST have finite timeouts and cancellation behavior.
- **FR-NET-006:** Automatic reconnection MUST use bounded exponential backoff.

### 9.3 Authorization and actions

- **FR-AUTH-001:** The desktop MUST authorize every request independently of
  what the mobile interface displays.
- **FR-AUTH-002:** Permissions MUST be scoped by capability and operation.
- **FR-AUTH-003:** The mobile client MUST NOT send arbitrary shell text.
- **FR-AUTH-004:** Action requests MUST use typed, schema-validated arguments.
- **FR-AUTH-005:** Destructive actions MUST declare their risk and confirmation
  policy in desktop-owned metadata.
- **FR-AUTH-006:** Capability removal or permission revocation MUST invalidate
  stale mobile actions.

### 9.4 Clipboard and inbox

- **FR-INBOX-001:** Clipboard reads MUST follow a clear user gesture.
- **FR-INBOX-002:** MVP clipboard content MUST be UTF-8 plain text.
- **FR-INBOX-003:** Empty clipboard content MUST produce a non-error state.
- **FR-INBOX-004:** The sender MUST validate configured size limits before a
  transfer begins.
- **FR-INBOX-005:** Activity metadata MUST not contain clipboard or file content.
- **FR-INBOX-006:** Inbox retention MUST be configurable and support immediate
  deletion.
- **FR-INBOX-007:** Files MUST retain a safe display name while storage uses an
  application-generated identifier.
- **FR-INBOX-008:** Received files MUST never become executable solely because
  of their original name or mode.

### 9.5 Capability rendering

- **FR-CAP-001:** Mobile MUST render only supported declarative component types.
- **FR-CAP-002:** Catalogs MUST declare contract version and stable IDs.
- **FR-CAP-003:** Unknown fields MUST be ignored when safe; unknown required
  component types MUST produce an unsupported card.
- **FR-CAP-004:** Capability input must be validated on mobile for usability and
  again on desktop for security.
- **FR-CAP-005:** Pinned actions MUST resolve by stable ID, not display label.

## 10. Experience requirements

- **UX-001:** Home MUST communicate connection state without requiring a visit
  to Settings.
- **UX-002:** Offline state MUST preserve available cached structure but disable
  actions that cannot run.
- **UX-003:** The product MUST distinguish `Sent`, `Accepted`, `Completed`, and
  `Opened` and use only the strongest state actually known.
- **UX-004:** Core actions MUST meet platform touch-target and screen-reader
  requirements.
- **UX-005:** Color MUST NOT be the only indicator of connection, risk, or
  completion.
- **UX-006:** The active desktop theme MAY provide accent and wallpaper-derived
  colors, but mobile contrast and platform legibility rules take precedence.
- **UX-007:** Destructive confirmations MUST name the action and target desktop.
- **UX-008:** Diagnostics MUST be copyable without including secrets or content.

## 11. Reliability and performance

- Cold launch to usable cached Home: p95 under 1.5 seconds on supported devices.
- Local discovery first result: p95 under 5 seconds on a functioning LAN.
- Connected action acknowledgment: p95 under 500 ms on a functioning LAN.
- Text transfer acknowledgment: p95 under 1 second on a functioning LAN.
- Crash-free sessions: at least 99.8% during public beta.
- No duplicate execution after retries when the same idempotency key is used.
- Network interruption must never corrupt an already completed inbox item.

These are product targets, not guarantees across isolated guest Wi-Fi, sleeping
computers, vendor-modified Android background policies, or unavailable routes.

## 12. Success measures

### Activation

- Percentage of installers who complete one pairing.
- Median time from first launch to paired Home.
- Percentage of paired users who complete one continuity action.

### Habit and value

- Weekly paired users completing at least one action or transfer.
- Successful actions and transfers per weekly active paired user.
- Percentage of active users who pin or install a custom capability.
- Seven-day and thirty-day paired-device retention.

### Trust and quality

- Transfer and action success rate by route and platform.
- Pairing failure rate by failure reason.
- Permission denial and revocation frequency.
- Duplicate-execution incidents; target is zero.
- Confirmed payload-content leakage into telemetry or logs; target is zero.

Metrics MUST use anonymous local counters by default. Uploading product
analytics requires separate opt-in and a documented data contract.

## 13. Visual direction

- Follow [`native-design-system.md`](native-design-system.md).
- Use native navigation, controls, sheets, dialogs, progress, haptics, type
  scaling, and accessibility on each platform.
- On supported iOS versions, use official Liquid Glass for the functional layer
  of navigation and important interactive controls, not as decorative card
  backgrounds.
- On Android, use Jetpack Compose Material 3 and appropriate Material 3
  Expressive components rather than reproducing Liquid Glass.
- Use a synchronized Omarchy accent only after the native renderer corrects it
  for system contrast and accessibility.
- Use regular system interface type for reading; reserve monospace for
  identifiers, connection details, and command output.
- Keep actions concise and device status compact.
- Motion communicates connection and transfer state and respects platform
  reduced-motion preferences.

## 14. Open questions

1. Should the first store release support Android and iOS simultaneously, or
   ship iOS-first while keeping shared React Native architecture?
2. What are the default and maximum transfer sizes for LAN and tailnet routes?
3. Which initial actions are universal enough to ship as built-ins?
4. Should desktop-to-mobile delivery require the app to be open in MVP, or is
   an optional push relay required for launch?
5. How long should inbox files and activity metadata remain by default?
6. Is theme synchronization automatic, opt-in, or configured per desktop?
