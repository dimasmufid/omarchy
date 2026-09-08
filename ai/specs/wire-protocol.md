# Omarchy Link Wire Protocol

Status: Draft; not safe to implement without security review  
Protocol family: `omarchy-link`  
Initial application version: `1.0`  
Last updated: 2026-09-08

## 1. Purpose and boundaries

The Omarchy Link protocol connects a paired mobile client to one Omarchy
desktop. It carries capability discovery, typed action requests, activity
events, clipboard messages, and transfer negotiation.

This specification does not define new cryptographic primitives. The
implementation MUST use maintained TLS, certificate, random-number, and secure
storage libraries. A security review is required before production pairing or
remote routing ships.

## 2. Transport

### 2.1 Control channel

- TLS 1.3 is required.
- Phase 1 uses authenticated HTTPS request/response with UTF-8 JSON bodies.
- A later release MAY negotiate a WebSocket using subprotocol
  `omarchy-link.v1` for events, presence, and long-running capabilities.
- Maximum control-message size is 256 KiB unless a negotiated limit is lower.
- Files and large binary values MUST use the transfer channel.

JSON is chosen initially for debuggability and independent implementations.
The schema remains strict and versioned; switching encoding later must not
change application semantics.

Phase 1 endpoints are deliberately request/response. The client asks for status
when foregrounded and receives a terminal result for each clipboard, share, or
Lock request. Persistent presence, server-pushed catalog changes, heartbeats,
and action progress streams are post-MVP.

### 2.2 Transfer channel

- HTTPS on the daemon's authenticated listener.
- Upload and download URLs are scoped bearer capabilities delivered only over
  the authenticated control channel.
- Tokens bind transfer ID, paired device ID, direction, byte limit, and expiry.
- URLs expire in no more than five minutes but MAY authorize resumption of a
  longer transfer while the authenticated session remains valid.
- Receivers support verified ranged resumption when negotiated.

### 2.3 Discovery

The desktop advertises DNS-SD service type `_omarchy._tcp.local` with minimal
metadata:

| TXT key | Meaning |
|---|---|
| `id` | Truncated, non-secret desktop discovery identifier |
| `name` | Sanitized display name, maximum 63 UTF-8 bytes |
| `pv` | Highest protocol major version |
| `pair` | `1` only while a pairing window is open |

Discovery MUST NOT publish usernames, full hardware identifiers, installed
tools, pairing secrets, or public-key material. Already paired mobile clients
verify the discovered endpoint against their pinned desktop identity.

Manual host and port entry is required as a discovery fallback.

### 2.4 Optional Cloudflare relay

The post-MVP cloud route is specified in
[`cloud-infrastructure.md`](cloud-infrastructure.md).

- Both desktop and mobile connect outward to a per-relationship Durable Object.
- The Durable Object receives a bounded outer routing envelope and opaque inner
  ciphertext.
- The paired endpoints apply application-layer end-to-end encryption in
  addition to Cloudflare transport TLS.
- Cloud routing IDs are independent of local device and discovery IDs.
- Actions are never stored offline. An absent desktop produces
  `route.desktop_offline`.
- Offline file objects use separately negotiated, client-side encryption and
  private R2 storage.

## 3. Identity and pairing

### 3.1 Long-term identity

- Each installation has a randomly generated stable device ID.
- Each installation has an asymmetric device identity protected by its platform.
- Device display names are mutable metadata, never identity selectors.
- The desktop maintains a private local certificate authority or equivalent
  standard-library identity suitable for mutual TLS.

The final certificate profile and rotation scheme must be fixed during the
security spike. Application code MUST NOT implement custom signature or key
derivation algorithms.

### 3.2 Pairing URI

The desktop presents a QR code with a URI shaped like:

```text
omarchy://pair?v=1&desktop=<base64url-id>&secret=<base64url-random>&fp=<base64url-fingerprint>&host=<optional-hint>&port=<port>
```

Normative properties:

- `secret` contains at least 256 bits from a cryptographically secure RNG.
- `secret` is single-use, memory-resident where feasible, and expires within
  five minutes.
- `fp` pins the expected desktop pairing certificate or identity.
- `host` is only a connection hint and is never trusted as identity.
- The QR payload MUST NOT be logged or included in analytics.
- Opening a new pairing window invalidates the old token unless the desktop UI
  explicitly supports and displays multiple windows.

### 3.3 Pairing exchange

1. Mobile parses and validates the QR URI locally.
2. Mobile connects to a resolved or hinted endpoint and validates the presented
   desktop identity against `fp`.
3. Mobile submits the one-time secret, its public identity, display name,
   platform, application version, and requested baseline permissions.
4. Desktop verifies and consumes the token, then displays an approval request.
5. Desktop user accepts, modifies permissions, or rejects.
6. On acceptance, both sides establish standard mutual authentication material
   and store the peer identity.
7. Desktop returns device ID, granted permissions, and protocol limits.
8. Both sides close the special pairing session and create a normal session.

The pairing token alone MUST NOT complete pairing without desktop acceptance.
A rejected, expired, or used token cannot be retried.

### 3.4 Re-pairing and rotation

- A changed or lost peer identity requires explicit re-pairing.
- Certificate mismatch MUST NOT offer a one-tap "trust anyway" path.
- Identity rotation should use an authenticated rotation message signed or
  authorized by the current identity before it expires.
- Revoked identities remain in a bounded deny record to prevent stale cached
  sessions from appearing valid.

## 4. Session negotiation

In Phase 1, immediately after mutual authentication, mobile sends the following
body to `POST /v1/session`. The returned session metadata is used for subsequent
finite HTTPS requests. A later WebSocket transport sends the same logical hello
as its first application message.

```json
{
  "type": "session.hello",
  "id": "0198f42e-48d5-7c7d-a311-88a9f839993a",
  "protocol": { "major": 1, "minor": 0 },
  "device": {
    "id": "mob_7f3b1b31",
    "name": "Dimas's iPhone",
    "platform": "ios",
    "appVersion": "0.1.0"
  },
  "features": ["capabilities.v1", "transfer.v1", "clipboard.text.v1"],
  "limits": {
    "controlMessageBytes": 262144,
    "clipboardTextBytes": 65536
  }
}
```

Desktop responds with `session.welcome` containing the selected protocol,
feature intersection, effective lower limits, server time, permission revision,
catalog revision, and a new session ID.

Different protocol major versions are incompatible. A higher minor version may
be accepted only when required features and fields are understood.

## 5. Message envelope

Every post-negotiation control message uses:

```json
{
  "v": "1.0",
  "type": "action.invoke",
  "id": "0198f42f-17dc-74d6-b3df-c940229dfda4",
  "sessionId": "ses_2b87d6f1",
  "sentAt": "2026-09-08T12:34:56.789Z",
  "replyTo": null,
  "body": {}
}
```

Rules:

- `id` is a UUIDv7 or equally collision-resistant sortable identifier.
- `sessionId` is required after welcome and is not an authentication secret.
- `sentAt` is UTC RFC 3339 and is used with a bounded replay window.
- `replyTo` references the request ID for direct responses.
- `type` uses a stable lowercase dotted namespace.
- Unknown required message types receive `protocol.unsupported_message`.
- Unknown optional fields are ignored and preserved only when explicitly
  required by a proxy use case; v1 has no proxy behavior.

## 6. Core messages

Only status, clipboard, inbox/transfer, and hard-coded `system.lock` request
types are P0. Catalog, general action progress, server events, and presence are
reserved for later priorities even though their forward contract is documented
here.

### 6.1 Catalog

- `catalog.get`: request full catalog or changes after a known revision.
- `catalog.snapshot`: complete authorized catalog.
- `catalog.changed`: event containing new catalog revision.
- `permissions.changed`: event containing new permission revision and effective
  grants.

Example request:

```json
{
  "knownRevision": 14,
  "supportedComponents": [
    "card.status.v1",
    "control.action.v1",
    "control.toggle.v1",
    "control.progress.v1"
  ]
}
```

### 6.2 Action

`action.invoke` body:

```json
{
  "capabilityId": "omarchy.system",
  "actionId": "lock",
  "catalogRevision": 15,
  "idempotencyKey": "0198f432-0555-7ca7-8503-bb4fd44d0047",
  "arguments": {},
  "confirmation": {
    "challengeId": null
  }
}
```

Possible responses/events:

- `action.accepted`
- `action.progress`
- `action.completed`
- `action.failed`
- `action.outcome_unknown`
- `action.confirmation_required`

`accepted` means authorized and queued, not completed. A terminal event is
required when the outcome is known.

### 6.3 Confirmation

For desktop-enforced confirmation:

1. Initial invocation returns `action.confirmation_required` with a short-lived
   `challengeId`, authoritative title, consequence text, target, and expiry.
2. Mobile renders those exact semantic fields using trusted client chrome.
3. User confirms and resends the same action and idempotency key with the
   `challengeId`.
4. Desktop binds the challenge to device, action, normalized arguments, and
   catalog revision.

A challenge cannot authorize modified arguments or another action.

### 6.4 Clipboard

- `clipboard.push_text`: phone sends foreground-read text to desktop.
- `clipboard.pull_text`: phone explicitly requests current desktop text.
- `clipboard.text`: response containing text or `empty: true`.

Clipboard messages are marked sensitive in internal representations. Payloads
MUST be excluded from logging, tracing, crash breadcrumbs, and activity titles.

### 6.5 Inbox and transfers

- `inbox.offer`: offer metadata before sending bytes.
- `inbox.accept`: return transfer token, limits, and supported range.
- `inbox.reject`: typed reason without receiving bytes.
- `transfer.progress`: rate-limited state event.
- `transfer.complete`: receiver has verified and finalized payload.
- `transfer.cancel`: either side requests cancellation.
- `transfer.failed`: terminal typed failure.

Offer example:

```json
{
  "transferId": "0198f433-b9b7-7744-a1de-452f5b1825cb",
  "kind": "file",
  "displayName": "omarchy-mobile-notes.md",
  "mediaType": "text/markdown",
  "sizeBytes": 4812,
  "sha256": "base64url-digest",
  "source": "share_extension"
}
```

The digest verifies transport integrity and MUST NOT be emitted to general logs.
It is not a malware or trust signal.

### 6.6 Presence and heartbeat

This section is post-MVP and applies only after a persistent event transport is
introduced.

- Either peer MAY send `session.ping`.
- The receiver answers `session.pong` promptly.
- Missing heartbeats make the connection unavailable but do not revoke pairing.
- Mobile background state MUST NOT be interpreted as reliable presence.

## 7. Error model

Error body:

```json
{
  "code": "action.permission_denied",
  "message": "This phone is not allowed to lock dimas-framework.",
  "retryable": false,
  "details": {}
}
```

Stable error namespaces:

| Namespace | Examples |
|---|---|
| `protocol.*` | invalid message, unsupported version, too large |
| `auth.*` | unauthenticated, revoked, identity mismatch |
| `pairing.*` | expired, used, rejected, pending |
| `action.*` | unavailable, invalid arguments, denied, timeout |
| `clipboard.*` | empty, unsupported type, too large |
| `transfer.*` | rejected, no space, digest mismatch, expired |
| `provider.*` | unavailable, timeout, invalid response |
| `rate.*` | request limit, concurrency limit |

Messages are safe user-facing summaries, not raw exception strings. Clients
branch on `code`, never on localized `message`.

## 8. Idempotency and reconciliation

- Every state-changing request requires an idempotency key.
- Desktop stores the key, paired device ID, normalized request digest, state,
  and terminal response for a bounded period of at least 24 hours.
- Reuse with the identical request returns current or terminal state.
- Reuse with different content returns `protocol.idempotency_conflict`.
- Client retries only after connection failure or an explicitly retryable error.
- After reconnect, client sends `activity.reconcile` with unresolved request and
  transfer IDs.
- If the desktop cannot prove whether an action completed, it returns
  `action.outcome_unknown`; the client must not automatically execute it again.

## 9. Ordering and concurrency

- No global ordering across capabilities is guaranteed.
- Events for one action have a monotonically increasing `sequence` starting at
  zero.
- The desktop rejects or queues overlapping requests according to the action's
  declared concurrency policy.
- Clipboard writes use `replace_latest` semantics only when explicitly invoked;
  they are never coalesced across different user actions.
- Progress events SHOULD be limited to four updates per second per transfer.

## 10. Rate and resource limits

Initial defaults, adjustable downward by negotiation:

| Resource | Default |
|---|---:|
| Control message | 256 KiB |
| Clipboard text | 64 KiB |
| Outstanding actions per mobile | 8 |
| Concurrent transfers per mobile | 2 |
| Pairing attempts per window | 5 |
| Invalid messages before disconnect | 3 |
| Action result text | 16 KiB |

File-size defaults remain an open product decision. The receiver is always
authoritative for effective limits and free-space checks.

## 11. Versioning

- Protocol version is `{major}.{minor}`.
- Major changes may break message meaning or required behavior.
- Minor changes add optional messages, fields, errors, or component types.
- Capability components carry their own versioned type.
- Feature names are explicit and negotiated.
- Desktop SHOULD support the current and previous stable protocol major during
  a migration window when feasible.
- Clients must explain upgrade requirements rather than retry indefinitely.

## 12. Schema and conformance artifacts

Before implementation, this prose specification should produce:

- JSON Schema files for every message body and the envelope;
- generated TypeScript types;
- Rust serde models;
- Swift and Kotlin DTOs or generated equivalents;
- canonical valid and invalid fixtures;
- a protocol transcript with sensitive fields replaced;
- compatibility tests that run every supported client against every supported
  daemon protocol version.

## 13. Protocol decisions still requiring review

1. Exact mutual-authentication certificate profile and rotation method.
2. Whether WebSocket is retained after the spike or replaced by HTTP/2 or QUIC.
3. Whether local service advertising should rotate its discovery identifier.
4. Transfer resume semantics and maximum token lifetime.
5. Clock-skew tolerance and replay-window size.
6. Whether tailnet endpoints may be learned automatically or only configured.
