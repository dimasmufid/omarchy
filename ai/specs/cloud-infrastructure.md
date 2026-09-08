# Omarchy Mobile Cloud Infrastructure

Status: Draft  
Cloud provider: Cloudflare  
Relational database: PlanetScale Postgres  
Last updated: 2026-09-08

## 1. Purpose

This document defines the optional cloud infrastructure for Omarchy Mobile.
Cloudflare is the preferred cloud ecosystem. PlanetScale Postgres stores
durable control-plane metadata through Cloudflare Hyperdrive.

The cloud extends reachability; it does not replace the user's Omarchy computer
as the authority. Phase 1 remains fully functional on a LAN without Cloudflare,
PlanetScale, a VPS, or an Omarchy account.

Official references:

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Durable Object WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [PlanetScale Postgres with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/planetscale-postgres/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)

## 2. Infrastructure principles

### 2.1 Local operation is complete operation

- Pairing, LAN discovery, clipboard, local sharing, and Lock do not require the
  cloud.
- Cloud failure cannot invalidate a healthy local pairing.
- Cloud enablement is explicit and reversible per desktop.
- Disabling cloud removes cloud routing and metadata without removing the local
  pairing unless the user chooses to revoke it too.

### 2.2 The desktop remains authoritative

- The desktop authorizes every action immediately before execution.
- The Worker and Durable Object cannot grant a capability the desktop denied.
- Remote actions are never placed in a durable offline queue.
- Cloud metadata is not a replacement for desktop permission state.

### 2.3 Cloudflare cannot read user payloads

- Relayed control messages use application-layer end-to-end encryption between
  the paired phone and desktop.
- Offline files are encrypted before upload to R2.
- Cloud services see routing metadata, ciphertext size, timing, and network
  metadata, but not clipboard values, files, action arguments, or results.
- No payload-derived hashes are placed in routine cloud logs or analytics.

### 2.4 Use each product for one job

| Product | Responsibility |
|---|---|
| Workers | Public API, authentication, validation, rate limiting, routing |
| Durable Objects | One live relay room per enabled desktop relationship |
| PlanetScale Postgres | Durable control-plane metadata and revocation records |
| Hyperdrive | Pooled Worker access to PlanetScale Postgres |
| R2 | Short-lived encrypted offline file objects |
| Queues | Retryable push delivery and asynchronous cleanup signals |
| Secrets Store / Worker secrets | APNs, FCM, signing, and service credentials |
| WAF / rate limiting | Public endpoint abuse controls |
| Analytics Engine or logs | Optional content-free operational metrics |

KV and D1 are not part of the initial architecture. Add them only for a
documented access pattern that PlanetScale, Durable Object storage, or static
configuration cannot satisfy.

## 3. Priority and rollout

### P0: Phase 1 local MVP

Cloud resources required: none.

- Mobile talks directly to `omarchy-linkd` over authenticated HTTPS.
- Pairing and permission state remain on the paired devices.
- The desktop inbox contains received content.
- The app may fetch a static compatibility document from a Worker, but this is
  optional, cacheable, and non-blocking.

### P1: optional online relay

Cloud resources:

- public API Worker;
- one `RelayRoom` Durable Object per cloud-enabled desktop relationship;
- PlanetScale Postgres through Hyperdrive;
- secrets and rate limiting;
- optional Queue consumer for push notifications.

P1 supports live remote request/response only while the desktop is connected.
It does not store remote actions for later execution.

### P2: encrypted offline delivery

Additional resources:

- private R2 bucket;
- short-lived upload/download grants;
- lifecycle deletion rules;
- Queues and scheduled cleanup reconciliation;
- optional APNs/FCM notification delivery.

P2 permits offline content delivery, not offline action execution.

## 4. Architecture

### 4.1 Local path

```text
Expo mobile ───── pinned TLS over LAN ───── omarchy-linkd
     │                                          │
secure identity                           desktop authority
```

Cloudflare is not contacted for a successful local operation.

### 4.2 Live remote path

```text
                           Cloudflare
                 ┌────────────────────────┐
                 │ API Worker             │
                 │ auth · limits · route  │
                 └───────────┬────────────┘
                             │ service binding
                 ┌───────────▼────────────┐
                 │ RelayRoom Durable Obj. │
                 │ one per relay link     │
                 │ hibernating WebSockets │
                 └──────┬───────────┬─────┘
                        │ ciphertext│
              WebSocket│           │WebSocket
                        │           │
                 Expo mobile    omarchy-linkd
```

Both phone and desktop initiate outbound WebSockets to Cloudflare. The Durable
Object is the WebSocket server and uses the hibernation API. It routes opaque
encrypted frames; it does not terminate application-layer encryption.

### 4.3 Durable metadata path

```text
Worker ── Hyperdrive ── PlanetScale Postgres
```

Use direct Postgres drivers supported by Hyperdrive, such as `pg` or
Postgres.js. Use parameterized queries and short transactions. Do not perform a
database round trip for every relayed frame.

### 4.4 Offline file path

```text
sender encrypts
      │
      ├── request scoped grant ── Worker
      │
      └── encrypted bytes ─────── private R2
                                      │
                                 receiver downloads
                                      │
                                 receiver decrypts
```

The per-transfer content key is delivered only inside the paired devices'
end-to-end encrypted control channel. It is never stored in PlanetScale, R2
metadata, Durable Object storage, Queue messages, or Worker logs.

## 5. Cloud identity and enablement

### 5.1 Relationship to local pairing

Local pairing establishes the mobile and desktop application identities first.
Enabling remote relay is a later operation initiated on the desktop.

1. Desktop creates a random 256-bit `relay_link_id` and a dedicated cloud
   authentication key.
2. Desktop registers the relay link and authentication public key with Worker.
3. The already encrypted local channel shares relay configuration with the
   paired phone.
4. Phone registers its cloud authentication public key as a member of the link.
5. Worker stores public authentication material and revocation metadata.
6. Each client completes a signed challenge and receives a short-lived,
   audience-bound connection token.

The exact standard signature, token, and application-layer encryption protocol
must be selected in the security spike. Do not implement custom cryptography.

### 5.2 No required account

P1 supports accountless relay links. A random relay link and paired identities
are sufficient. A future optional account can manage recovery, multiple
desktops, billing, and push registration, but local and direct remote pairing do
not depend on it.

### 5.3 Identifiers

- Public API paths never contain a raw local desktop device ID.
- `relay_link_id` is random, non-sequential, and independent of LAN discovery
  identity.
- Durable Object names are derived from a keyed digest of `relay_link_id`, not a
  username, email, hostname, or public device identifier.
- Logs use short-lived request IDs and truncated relationship references.

## 6. Worker responsibilities

The public Worker is the only internet-accessible application entry point.

Responsibilities:

- validate method, path, content type, body size, and schema;
- issue and verify challenges and short-lived connection tokens;
- enforce device and relay-link status from PlanetScale;
- apply per-IP, per-device, and per-link rate limits;
- route authenticated relay upgrades to the correct Durable Object;
- issue scoped R2 transfer grants;
- enqueue content-free push events;
- expose compatibility and service-status endpoints;
- return stable, non-sensitive error codes.

It MUST NOT:

- decrypt end-to-end payloads;
- accept arbitrary destination Durable Object names from clients;
- proxy large file bytes when direct R2 upload/download is available;
- log authorization headers, signed challenges, ciphertext bodies, object URLs,
  push tokens, or database credentials;
- authorize a desktop capability or claim that a remote action completed.

Proposed public endpoints:

```text
POST   /v1/relay-links/register
POST   /v1/relay-links/:link/connect-token
POST   /v1/relay-links/:link/devices/register
DELETE /v1/relay-links/:link/devices/:device
GET    /v1/relay-links/:link/socket
POST   /v1/transfers
POST   /v1/transfers/:transfer/complete
DELETE /v1/transfers/:transfer
PUT    /v1/push-endpoints/current
DELETE /v1/push-endpoints/current
GET    /v1/compatibility
GET    /health
```

Names are provisional. Route implementations receive validated internal IDs;
they do not pass user-controlled strings directly to Durable Object lookup,
database identifiers, or R2 keys.

## 7. RelayRoom Durable Object

### 7.1 Coordination atom

Use one Durable Object per `relay_link_id`. Never use one global object for all
devices or users.

The room coordinates a small set of connections for one desktop relationship:

- zero or one authoritative desktop connection in P1;
- zero or more authorized phone connections in later multi-device releases;
- request/response correlation for currently connected peers;
- active revocation and connection shutdown;
- bounded rate and in-flight request state.

### 7.2 WebSocket behavior

- Use the Durable Objects WebSocket hibernation API.
- Store only minimal authenticated connection metadata in serialized WebSocket
  attachments.
- Reconstruct all in-memory indexes after hibernation.
- Persist critical room revision or revocation state before acknowledging
  administrative changes.
- Do not run timers to keep the object awake.
- Use protocol ping/pong or platform auto-response behavior that does not defeat
  hibernation.
- Bound frames, connections, outstanding requests, and per-connection send
  buffers.

### 7.3 Routing rules

- Only a connection authenticated as the registered desktop may occupy the
  desktop role.
- A replacement desktop connection closes the old connection using a typed
  reason after proving a newer valid session.
- Mobile frames route only to the desktop in the same link.
- Desktop response frames route only to the requesting mobile connection.
- Broadcast is forbidden for clipboard, file keys, actions, and results.
- Unknown, malformed, oversized, expired, or incorrectly addressed frames are
  rejected before forwarding.

The Durable Object validates the outer routing envelope but cannot inspect the
encrypted inner Omarchy protocol message.

### 7.4 Storage ownership

PlanetScale is the long-lived control-plane authority. Durable Object SQLite
stores only coordination state that benefits from single-object consistency:

- room schema version;
- current authorization revision cache;
- active connection generation;
- bounded request correlation metadata;
- one cleanup alarm schedule, if needed.

Do not duplicate accounts, complete permission models, file records, or product
analytics into Durable Object storage. A documented reconciliation policy is
required for any duplicated field.

## 8. PlanetScale Postgres

### 8.1 Role

PlanetScale holds centralized metadata that must survive Durable Object
replacement and be queried outside one live relay room.

Proposed tables:

```text
relay_links
  id, public_handle_hash, status, auth_revision, created_at, revoked_at

relay_devices
  id, relay_link_id, role, auth_public_key, status, created_at, revoked_at

push_endpoints
  id, relay_device_id, platform, encrypted_token, environment, updated_at

transfers
  id, relay_link_id, sender_device_id, receiver_device_id,
  object_key, ciphertext_size, state, expires_at, completed_at

accounts                 # optional, post-accountless P1
account_relay_links       # optional
subscriptions             # optional
```

There are no clipboard, action payload, action result, original filename,
content key, local IP address, or private identity columns.

### 8.2 Hyperdrive access

- Worker connects through a dedicated Hyperdrive binding.
- Use a least-privilege PlanetScale role for each environment.
- Use TLS identity verification supported by the integration.
- Use `pg` or Postgres.js through Hyperdrive rather than stacking Hyperdrive on
  another serverless proxy driver.
- Parameterize every value.
- Keep transactions short and never hold a database connection across external
  network calls.
- Run schema migrations as a separate deployment step, not lazily on requests.
- Disable query caching for authorization and revocation reads unless the design
  proves the cache cannot delay enforcement.

### 8.3 Consistency

- Registration and revocation are transactional.
- Revocation increments `auth_revision`.
- Connection tokens carry the revision and have short expiry.
- Worker notifies the live Durable Object of a new revision after commit.
- Failure to notify does not roll back revocation; token expiry and the next
  authorization read close the gap.
- Durable Object does not write through to PlanetScale for every relayed frame.

## 9. R2 encrypted transfer storage

- Bucket is private with public access disabled.
- Object keys contain random IDs and environment prefix, never user-supplied
  filenames.
- Clients receive single-object, single-operation, short-lived authorization.
- Only encrypted bytes are uploaded.
- Metadata needed to decrypt travels through the end-to-end encrypted control
  channel.
- Sender records plaintext size and digest inside encrypted metadata; cloud
  records only ciphertext size needed for quota enforcement.
- Receiver verifies authenticated encryption, plaintext length, and digest
  before finalizing.
- Lifecycle rules delete expired objects, with scheduled reconciliation for
  database rows and partial multipart uploads.
- Completing, canceling, expiring, or revoking a transfer removes future grants.
- A successful download does not automatically delete until the receiver sends
  an authenticated completion acknowledgment or expiry occurs.

R2 transfer is P2. Phase 1 continues to stream directly to the desktop inbox.

## 10. Queues and push

Use separate queues for unrelated retry policies:

- `push-events`: content-free APNs/FCM wake or availability notifications.
- `transfer-cleanup`: reconcile expired R2 objects and Postgres metadata.
- `security-events`: optional bounded processing of abuse signals without
  payload data.

Queue delivery is at least once. Every consumer operation is idempotent and
uses a stable event ID. Push notifications say only that Omarchy has activity;
they do not contain clipboard text, filenames, action arguments, or content
keys.

Remote action requests MUST NOT be placed on a Queue. If the desktop is not
connected, the Worker returns `desktop_offline`.

## 11. Secrets and configuration

Secrets:

- PlanetScale credentials are owned by the Hyperdrive configuration.
- APNs and FCM credentials use Cloudflare secrets storage.
- Token-signing keys use secrets storage with an explicit rotation procedure.
- R2 application credentials are not shipped to the mobile or desktop; scoped
  operations use Worker bindings or narrowly scoped temporary grants.

Non-secret configuration:

- environment name;
- public API origin;
- protocol minimum and maximum;
- feature flags that cannot weaken security;
- per-route size and rate limits;
- retention durations;
- observability sampling.

No secret belongs in `wrangler.jsonc`, source control, Expo public config,
mobile JavaScript bundles, crash reports, or CI output.

## 12. Environments

Use completely separate Cloudflare resources and PlanetScale credentials:

| Environment | Purpose | Data policy |
|---|---|---|
| local | Worker/DO tests and fake services | Synthetic only |
| development | Shared integration | Test devices and synthetic content |
| staging | Release candidate and migrations | No production identities |
| production | Public service | Production retention and security policy |

Do not reuse Durable Object namespaces, R2 buckets, Queues, Hyperdrive
configurations, secrets, or push credentials across staging and production.

## 13. Deployment

### 13.1 Worker application

Recommended source layout:

```text
apps/cloud/
├── src/
│   ├── index.ts
│   ├── routes/
│   ├── auth/
│   ├── durable-objects/relay-room.ts
│   ├── db/
│   ├── queues/
│   └── observability/
├── migrations/
├── test/
├── wrangler.jsonc
└── package.json
```

Deployment order:

1. Validate schemas, types, unit tests, and Cloudflare integration tests.
2. Back up and migrate PlanetScale schema with a backward-compatible change.
3. Deploy Worker and Durable Object migrations to staging.
4. Run live staging connection, hibernation, revocation, and transfer tests.
5. Deploy production with a pinned compatibility date.
6. Run synthetic health and rollback checks.
7. Remove old schema only after all supported clients have migrated.

Use Wrangler configuration as code. Generate current Worker binding types in CI.
Durable Object migration tags are append-only and tested before deployment.

### 13.2 Mobile and daemon configuration

- Production cloud origin is compiled into the native runtime configuration.
- A development menu may override the origin only in non-production builds.
- Direct LAN is attempted first unless the user explicitly chooses remote-only.
- Desktop relay connection is disabled until the user enables it.
- Revoking cloud access removes relay credentials and closes the connection.

## 14. Observability

Allowed cloud telemetry:

- request ID, route template, response class, duration;
- anonymous environment-scoped link reference;
- connection role and lifecycle state;
- ciphertext byte count;
- typed error and retry count;
- Durable Object wake/hibernation and connection counts;
- database and queue duration without query values or message bodies.

Forbidden cloud telemetry:

- full IP address beyond provider-required operational retention;
- raw device or relay identifiers;
- access tokens, signed challenges, public keys in routine logs;
- WebSocket frame body or ciphertext;
- clipboard values, action messages, filenames, notification tokens;
- presigned or scoped transfer URLs;
- SQL bind values.

Alerts:

- elevated authentication failures or rate limiting;
- PlanetScale/Hyperdrive errors;
- Durable Object connection failure rate;
- Queue age and dead-letter growth;
- R2 cleanup backlog;
- unexpected egress, storage, or request-cost increase.

## 15. Reliability behavior

| Failure | Required behavior |
|---|---|
| Worker unavailable | Fall back to LAN when reachable; remote shows unavailable |
| Durable Object restarts/hibernates | Reconstruct attachment state; clients reconnect if necessary |
| Desktop relay disconnected | Return `desktop_offline`; do not queue action |
| PlanetScale unavailable | Reject new sessions/grants that require authority; existing short-lived sessions expire normally |
| Hyperdrive error | Bounded retry only for safe reads; never duplicate writes |
| Queue delayed | Push may arrive late; core relay correctness unaffected |
| R2 unavailable | Preserve sender source; fail or retry transfer explicitly |
| Revocation notification fails | Database remains authoritative; short token lifetime limits stale access |
| Region/provider outage | Local LAN behavior remains functional |

## 16. Abuse controls

- Rate limit challenge creation, failed authentication, WebSocket upgrades,
  transfer creation, and push registration.
- Bound connections per relay link and per device.
- Reject unsupported methods and content types before reading full bodies.
- Apply strict Worker and Durable Object input-size limits below platform maxima.
- Do not expose whether a guessed relay link exists.
- Use generic external authentication errors and detailed redacted internal
  reason codes.
- Require re-authentication for device registration and revocation.
- Apply quotas to R2 ciphertext bytes and transfer count.
- Maintain a kill switch for relay and offline uploads without affecting LAN.

## 17. VPS and Dokploy boundary

The existing Dokploy VPS is an escape hatch, not part of the normal cloud path.
Use it only when a requirement cannot be handled safely or economically by the
Cloudflare architecture, such as:

- raw TCP/UDP protocol termination;
- native binary processing or malware scanning;
- unusually long CPU-heavy jobs;
- a self-hosted relay edition;
- provider portability testing.

Any VPS service sits behind a narrow authenticated Worker-facing API where
possible, ships as a pinned container, runs without root, and has explicit
resource, network, log, backup, and update policy. PlanetScale remains the
preferred relational database; do not operate another Postgres instance by
default.

## 18. Infrastructure tests

- Worker route schema, authentication, rate-limit, and redaction tests.
- Durable Object multi-room isolation and role enforcement.
- Hibernation wake with restored WebSocket attachments.
- Revocation while phone and desktop are connected.
- Duplicate connect and generation replacement.
- PlanetScale migration and rollback compatibility.
- Hyperdrive failure, timeout, and uncached revocation behavior.
- Queue duplicate delivery and dead-letter handling.
- R2 expired grant, wrong object, oversized ciphertext, interrupted multipart,
  tampered ciphertext, and lifecycle cleanup.
- Local operation while every cloud dependency is unavailable.

Use `@cloudflare/vitest-pool-workers` or the current official Workers testing
integration for Worker and Durable Object runtime tests. Physical-device remote
tests still run against staging.

## 19. Cost controls

- Phase 1 cloud cost target is zero because cloud is not required.
- Durable Objects use hibernating WebSockets and one object per relay link.
- Do not query PlanetScale for each relay frame.
- Upload files directly to R2 using scoped grants.
- Apply short R2 lifecycle retention and per-link quotas.
- Sample non-security operational metrics.
- Configure budget alerts before public remote access.
- Review Workers, Durable Objects, R2, Queue, Hyperdrive, and PlanetScale pricing
  immediately before beta; do not encode old numeric limits into product copy.

## 20. Decisions still required

1. Exact audited application-layer E2EE protocol and library.
2. Short-lived connection token format, signer, and rotation.
3. PlanetScale database region relative to expected early users.
4. Whether push exists in P1 or ships with P2 offline delivery.
5. Maximum online relay frame and offline R2 object sizes.
6. Default R2 expiry and completed-download deletion grace period.
7. Whether an optional Omarchy account is ever needed for paid relay service.
8. Open-source/self-hosted relay compatibility expectations.

