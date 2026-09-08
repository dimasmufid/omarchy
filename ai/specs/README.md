# Omarchy Mobile Specifications

Status: Draft  
Owner: Dimas Mufid  
Last updated: 2026-09-08

This directory is the source of truth for Omarchy Mobile: a local-first mobile
companion for an Omarchy computer. The product extends the principle "the OS
that we own" to a trusted phone surface without turning the phone into a small
Linux administration console.

## Documents

| Document | Purpose |
|---|---|
| [MVP priorities](mvp-priorities.md) | Authoritative Phase 1 cut, priorities, deferred scope, and build order |
| [Product requirements](product-requirements.md) | Product thesis, users, scope, requirements, UX, and success measures |
| [System design](system-design.md) | Runtime components, responsibilities, data flow, storage, and failure behavior |
| [Wire protocol](wire-protocol.md) | Pairing, discovery, sessions, message envelopes, transfers, errors, and versioning |
| [Capability contract](capability-contract.md) | How built-in and user-owned tools expose safe mobile cards and actions |
| [Security and privacy](security-and-privacy.md) | Trust model, threat model, permissions, secret handling, logging, and recovery |
| [Platform behavior](platform-behavior.md) | iOS and Android constraints and the required product behavior for each |
| [Delivery and verification](delivery-and-verification.md) | Milestones, repository shape, testing strategy, acceptance gates, and rollout |

## Working decisions

These decisions are normative unless replaced by a documented decision:

1. The mobile client uses React Native, TypeScript, and Expo development builds.
2. Swift and Kotlin modules own platform-specific networking, background work,
   secure identity storage, app extensions, and operating-system integrations.
3. A small Rust daemon on the Omarchy computer owns pairing, encrypted
   sessions, authorization, capability execution, and file transfer.
4. The Omarchy shell plugin is a presentation layer over the daemon; it does
   not own durable connections or device trust.
5. Communication is local-first. LAN is the default, Tailscale is a supported
   route, and a public relay is outside the first release.
6. No Omarchy account is required.
7. Mobile clients cannot submit arbitrary shell strings. The desktop publishes
   typed, allowlisted capabilities and enforces every request.
8. Mobile operating-system limits are product constraints. The app must not
   describe scheduled or foreground-only behavior as continuous background
   synchronization.
9. Existing KDE Connect clipboard work is a useful compatibility path and
   product prototype, but the new mobile protocol must not depend on the KDE
   Connect application being installed.
10. Phase 1 is intentionally foreground-only, same-LAN, and limited to one
    phone paired with one desktop. `mvp-priorities.md` is authoritative when a
    broader document describes later capabilities.

## Product vocabulary

| Term | Meaning |
|---|---|
| Desktop | An Omarchy computer running the companion daemon |
| Mobile | An iPhone, iPad, Android phone, or Android tablet running Omarchy Mobile |
| Device | Either side of a paired relationship |
| Capability | A desktop-published status surface or typed action available to mobile |
| Tool | A built-in or user-installed provider of one or more capabilities |
| Pairing | Explicit exchange of device identities and permissions initiated by QR code |
| Local route | Direct connection over a mutually reachable LAN |
| Tailnet route | Direct private connection over an existing Tailscale network |
| Session | An authenticated connection between already paired devices |
| Inbox item | Text, URL, file, or media intentionally transferred to a device |

## Change policy

- Update the PRD when user-visible scope or product behavior changes.
- Update the system design and protocol together when runtime boundaries change.
- Add a protocol compatibility note before changing a public message or
  capability shape.
- Security-sensitive changes require new abuse cases and tests in the security
  and verification documents.
- Unresolved decisions should stay explicit; do not silently encode them only
  in implementation.

## Open product decisions

- Final public product name and application identifiers.
- Whether v1 supports one desktop or multiple desktops in the main navigation.
- Whether remote notifications require an optional relay after the local-first
  release.
- Whether third-party mobile capability renderers are ever permitted, or the
  client remains limited to built-in declarative component types.
- App Store and Play Store distribution versus an additional self-built release
  channel.
