# Omarchy Mobile Capability Contract

Status: Draft  
Contract version: `1.0`  
Last updated: 2026-09-08

## 1. Purpose

Capabilities let Omarchy and owner-installed tools publish useful mobile status
and actions without requiring new mobile code for every integration.

The contract is declarative. A provider supplies data and typed action
definitions; the official mobile application renders a finite set of native
components. Providers cannot send executable JavaScript, HTML, QML, Swift,
Kotlin, CSS, SVG, or arbitrary layout instructions.

## 2. Design principles

- The owner decides what is exposed.
- The desktop remains authoritative for permission and execution.
- Stable semantic IDs are separate from mutable display labels.
- Mobile controls remain accessible and visually consistent.
- Unknown provider content fails locally and does not compromise other tools.
- Risk is declared by the provider and may be raised by policy, never lowered
  by the mobile client.
- The component set grows deliberately rather than becoming a remote web view.

## 3. Catalog

The desktop returns only capabilities authorized for the paired phone.

```json
{
  "contractVersion": "1.0",
  "revision": 15,
  "generatedAt": "2026-09-08T12:34:56Z",
  "capabilities": []
}
```

Catalog rules:

- `revision` increases whenever visible shape, status, action metadata, or
  authorization changes.
- Catalog order is a hint; user pins and mobile accessibility settings win.
- A catalog is bounded to 128 capabilities and 512 total controls in v1.
- Untrusted text is length-limited and rendered as plain text.

## 4. Capability shape

```json
{
  "id": "dev.server",
  "providerId": "dimasmufid.dev-tools",
  "version": "1.2.0",
  "title": "Development server",
  "subtitle": "Portfolio",
  "description": "Local project preview",
  "category": "development",
  "icon": "server",
  "accent": "theme",
  "availability": {
    "state": "available",
    "message": null
  },
  "components": [],
  "actions": [],
  "updatedAt": "2026-09-08T12:34:56Z"
}
```

Constraints:

- IDs match `^[a-z0-9][a-z0-9._-]{0,127}$`.
- `providerId + id` is globally stable on a desktop installation.
- Titles are at most 60 characters; subtitles at most 100; descriptions at most
  240.
- `icon` references the client's supported semantic icon vocabulary. Remote
  image URLs and raw SVG are forbidden in v1.
- `accent` is `theme`, one of a small semantic set, or absent. Arbitrary colors
  do not override contrast requirements.

## 5. Supported components

### 5.1 Status row: `card.status.v1`

Displays a label and current value.

```json
{
  "type": "card.status.v1",
  "id": "server-state",
  "label": "Status",
  "value": "Running",
  "tone": "positive",
  "detail": "Port 3000"
}
```

Allowed tones: `neutral`, `positive`, `warning`, `critical`, `inactive`.
Tone is supplementary; label and value remain understandable without color.

### 5.2 Progress: `control.progress.v1`

```json
{
  "type": "control.progress.v1",
  "id": "build-progress",
  "label": "Build",
  "value": 0.68,
  "detail": "Bundling application"
}
```

`value` is between zero and one or `null` for indeterminate state.

### 5.3 Action: `control.action.v1`

```json
{
  "type": "control.action.v1",
  "id": "open-preview-control",
  "actionId": "open-preview",
  "label": "Open",
  "style": "primary",
  "enabled": true,
  "disabledReason": null
}
```

Styles are `primary`, `secondary`, or `destructive`. Providers cannot supply
layout measurements or font styles.

### 5.4 Toggle: `control.toggle.v1`

```json
{
  "type": "control.toggle.v1",
  "id": "focus-mode-control",
  "actionId": "set-focus-mode",
  "label": "Focus mode",
  "value": true,
  "enabled": true
}
```

Changing the toggle invokes its action with `{ "value": boolean }`. Mobile
shows a pending state until the desktop returns authoritative state.

### 5.5 Text block: `card.text.v1`

Plain, non-selectable explanatory text by default. Markdown and links are not
rendered in v1. A provider must expose an explicit `open_url` action for links.

### 5.6 Group: `card.group.v1`

Groups a bounded set of status and control components under a short label. V1
allows one level of grouping; recursive layout trees are rejected.

## 6. Action definition

```json
{
  "id": "restart-server",
  "label": "Restart",
  "description": "Restart the Portfolio development server.",
  "risk": "confirm",
  "permission": "dev.server.control",
  "availability": "available",
  "input": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "clearCache": {
        "type": "boolean",
        "title": "Clear build cache",
        "default": false
      }
    }
  },
  "result": {
    "presentation": "status",
    "sensitive": false
  },
  "timeoutMs": 30000,
  "concurrency": "single",
  "idempotent": false
}
```

### 6.1 Risk levels

| Risk | Mobile behavior | Example |
|---|---|---|
| `immediate` | Execute after tap | Pause media |
| `confirm` | Confirm with named target and consequence | Restart a service |
| `destructive` | Strong confirmation; never batch | Delete an inbox item |
| `desktop_confirm` | Approval must occur on desktop | Future privileged action |

Desktop policy MAY raise the effective risk. It MUST NOT accept a lower risk
because the mobile cache says otherwise.

### 6.2 Input subset

V1 accepts a constrained JSON-Schema-like subset:

- `object` with `additionalProperties: false`;
- `boolean`;
- bounded `string` with optional `enum`, `minLength`, and `maxLength`;
- bounded finite `number` or `integer` with `minimum` and `maximum`;
- single-choice `enum`;
- arrays only for bounded multi-select enum values.

Forbidden inputs:

- arbitrary files through action arguments;
- secrets or passwords;
- recursive objects;
- arbitrary command text;
- regular expressions supplied by the provider;
- unbounded strings or arrays.

Files use the transfer protocol and yield an opaque inbox item reference when a
capability explicitly accepts one.

### 6.3 Concurrency

- `single`: reject a new request while one is running.
- `queue`: execute in accepted order with a declared maximum queue length.
- `replace_pending`: replace work that has not begun; never interrupts running
  work.
- `parallel`: allowed only with a provider-declared maximum.

## 7. Built-in capabilities

MVP built-ins use the same contract as external providers:

| Capability ID | Initial actions |
|---|---|
| `omarchy.system` | Lock; report session state |
| `omarchy.media` | Play/pause; volume level |
| `omarchy.appearance` | Night light or owner-selected focus action |
| `omarchy.launcher` | Launch registered application or URL target |
| `omarchy.clipboard` | Push text; request text through dedicated sensitive flow |
| `omarchy.inbox` | Offer item; list recent safe metadata |

Shutdown, reboot, package installation, arbitrary process termination, and
privileged commands are excluded from initial built-ins.

## 8. Command-backed owner capabilities

An owner may define a local capability, for example:

```toml
schema = 1
id = "home.movie-mode"
title = "Movie mode"
icon = "display"

[[actions]]
id = "enable"
label = "Start"
risk = "confirm"
permission = "home.movie-mode.enable"
executable = "/home/dimas/.local/bin/movie-mode"
arguments = ["enable"]
timeout_seconds = 20
```

Security rules:

- `executable` is an absolute owner-controlled path.
- No shell is involved.
- Mobile values map only to explicitly typed argument positions.
- Environment is minimal and explicitly allowlisted.
- Working directory is fixed by desktop configuration.
- stdout and stderr have strict byte limits and are not returned by default.
- A modified definition increments catalog revision and invalidates confirmation
  challenges.
- Executable ownership and permissions are checked before registration.

Dynamic shell snippets embedded in manifests are forbidden.

## 9. Provider lifecycle

1. Provider connects to local user-scoped IPC.
2. Provider registers manifest and current component state.
3. Daemon validates IDs, sizes, schemas, permissions, and supported components.
4. Valid capabilities enter the catalog and increment revision.
5. Provider publishes bounded state updates.
6. Daemon routes authorized action invocations to provider.
7. Provider returns accepted/progress/terminal states.
8. Disconnect marks capabilities unavailable; it does not silently remove user
   pins or authorization history.

Provider state updates SHOULD be coalesced and limited to four per second per
capability unless a lower negotiated rate applies.

## 10. Permission model

- Each action names one permission string.
- Permissions are granted per paired mobile device.
- New permissions introduced by a provider default to denied.
- Read-status and execute-action permissions are separate where disclosure is
  meaningful.
- Removing a provider does not grant a future provider with the same display
  name any permission.
- Reusing a provider ID after identity or ownership changes requires owner
  confirmation.

Example grants:

```json
{
  "deviceId": "mob_7f3b1b31",
  "revision": 9,
  "grants": [
    "omarchy.system.read",
    "omarchy.system.lock",
    "omarchy.media.read",
    "omarchy.media.control",
    "dev.server.read"
  ]
}
```

## 11. Result presentation

Actions return one of these bounded presentation hints:

- `none`: completion state only.
- `toast`: short safe message.
- `status`: refreshed capability state.
- `text`: bounded plain text screen; provider must declare sensitivity.
- `inbox_item`: reference to a completed transfer or generated artifact.

The client chooses final UI. Providers cannot request notification delivery,
clipboard writes, URL opening, or file execution indirectly through result text.

## 12. Compatibility and validation

- Mobile advertises supported component types during session negotiation.
- Desktop SHOULD omit optional unsupported components.
- If a required component is unsupported, mobile shows the capability as
  requiring an upgrade.
- All manifests are validated before becoming visible.
- Provider-supplied localization is deferred; v1 uses one default locale with
  plain fallback text.
- Golden catalog fixtures cover every supported component, invalid boundary,
  and unknown-version behavior.

## 13. Future candidates, not v1 contracts

- Time-series charts.
- Form sections with conditional fields.
- Rich media previews.
- Mobile widgets published by capabilities.
- Automation triggers.
- Capability-to-capability composition.
- Third-party icon assets.

Each addition requires accessibility, spoofing, resource, and compatibility
review before entering the supported vocabulary.

