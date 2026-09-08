# Phase 1 Release Checklist

Status: Active release gate  
Last reviewed: September 8, 2026

This checklist records evidence for the local-only Phase 1 release. A checked
item means the repository or CI currently proves it; it does not substitute for
the physical-device scenarios below.

## Automated and repository gates

- [x] TypeScript type checking passes.
- [x] Expo Doctor passes all checks.
- [x] Production JavaScript exports succeed for Android and iOS.
- [x] A clean Android prebuild compiles a Release AAB.
- [x] A clean iOS prebuild, CocoaPods install, and Release simulator build pass
  in CI.
- [x] Rust formatting, tests, and optimized daemon build pass.
- [x] Pairing approval grants no access until the phone completes the handshake.
- [x] Replaced, rejected, expired, invalid, and revoked pairing states deny
  authorization.
- [x] Interrupted uploads remove partial files; completed uploads verify size and
  SHA-256 before atomic finalization.
- [x] The desktop installer restarts the daemon on upgrade and waits for readiness.
- [x] No required cloud backend, analytics SDK, or crash-reporting SDK is present.
- [x] Privacy behavior is documented in [`../../PRIVACY.md`](../../PRIVACY.md).
- [x] Private vulnerability reporting and the public security policy are enabled.

## Physical-device release candidate

- [ ] Pair a freshly installed physical iPhone to a physical Omarchy desktop.
- [ ] Pair a freshly installed physical Android phone to the same desktop after
  revoking the iPhone.
- [ ] Verify rejection, expiry, restart/reconnect, IP change, and manual-address
  fallback with mDNS blocked.
- [ ] Push and pull non-empty and empty clipboard values on both platforms.
- [ ] Share text, URL, image, and file from at least two source apps on each
  platform; confirm one-item enforcement and explicit Send.
- [ ] Transfer a 25 MiB file, cancel an in-progress transfer, retry it, and verify
  the resulting digest and filename on the desktop.
- [ ] Lock the desktop, retry after a simulated disconnect, then revoke the phone
  and prove every subsequent request fails.
- [ ] Exercise camera/local-network denial and recovery, app background/foreground,
  force-quit, phone lock/unlock, desktop reboot, and phone reinstall.
- [ ] Review VoiceOver, TalkBack, Dynamic Type/font scaling, contrast, reduced
  motion, touch targets, and small-screen scrolling.
- [ ] Confirm application and daemon logs contain no clipboard value, file
  content, pairing URI, secret, credential, or transfer URL.

Record device models, OS versions, network topology, build identifiers, results,
and any screenshots with the release candidate.

## Account-owned Expo and store gates

- [ ] Sign in to the intended Expo owner account with `eas login`.
- [ ] Link or create the account-owned EAS project with `eas init`; commit the
  generated project ID after confirming ownership.
- [ ] Configure Apple team/App Store Connect access and Google Play signing.
- [ ] Run `eas build --profile preview --platform all` and install both artifacts
  on physical devices.
- [ ] Run `eas build --profile production --platform all` and retain artifact
  checksums and build URLs.
- [ ] Complete App Store privacy answers and Play Data safety answers from
  [`../../PRIVACY.md`](../../PRIVACY.md), then have the owner review them.
- [ ] Capture store screenshots, support URL, privacy-policy URL, release notes,
  age rating, category, and export-compliance answers.
- [ ] Submit to TestFlight and a closed Play track before production rollout.

## Release decision

Do not describe Phase 1 as production-ready until every physical-device and
account-owned gate above is checked, or an explicit owner-approved exception is
recorded with risk, scope, and rollback instructions.
