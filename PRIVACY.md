# Omarchy Mobile Privacy

Last updated: September 8, 2026

Omarchy Mobile is a local-first companion for a desktop that you own. Phase 1
does not require an Omarchy account, a hosted backend, advertising, analytics,
or third-party tracking. Core traffic travels directly between the mobile app
and the paired desktop over the network route selected by the user.

## Data the app handles

- A random phone identifier, paired desktop identifier, desktop certificate
  fingerprint, connection address, and authentication credential are stored in
  device-only secure storage so the app can reconnect.
- Clipboard text is read only after the user taps a clipboard action. Omarchy
  Mobile does not monitor or retain clipboard history.
- Text, URLs, images, and files are transferred only after an explicit send
  action. Received desktop files remain in the desktop's Omarchy Inbox until
  the user deletes them.
- The app stores a last-seen timestamp and displays local connection status.

Pairing QR secrets are single-use and are not retained after pairing. Payload
content, credentials, and pairing URIs are excluded from application logs.

## Permissions

- Local network and nearby-network access discover and connect to the desktop.
- Camera access scans a one-time pairing QR code. The app does not record audio.
- The system share extension receives only the single item explicitly shared to
  Omarchy Mobile.

Permissions can be changed in iOS or Android Settings. Removing a permission may
disable the related feature but does not grant the app another route to the data.

## Sharing and retention

Phase 1 does not send personal data to Omarchy-operated cloud services. Network
providers and operating systems may still process ordinary connection metadata
outside the app's control. The mobile pairing record remains until the user taps
"Forget this desktop" or removes the app. Forgetting locally does not revoke a
lost phone; run `omarchy-mobile revoke` on the desktop for immediate revocation.

On a fresh installation, the app clears any pairing credential that the mobile
operating system may have preserved outside the deleted app sandbox. To remove
desktop data, revoke the phone, uninstall the user service, and delete received
items from the Omarchy Inbox.

Exact desktop removal commands are documented in the project README.

This disclosure must be reviewed again before enabling any optional Cloudflare
relay, telemetry, crash reporting, or remote notification feature.
