# Omarchy Mobile

Omarchy Mobile is a local-first iPhone and Android companion for an Omarchy
desktop. Phase 1 pairs one phone directly over the LAN—without an account or
cloud backend—and supports explicit clipboard push/pull, text and file sharing,
and desktop lock.

The mobile application uses Expo React Native for product logic and `@expo/ui`
for real SwiftUI/Liquid Glass and Jetpack Compose Material 3 controls. A small
native Expo module provides certificate-pinned HTTPS, file upload, and Bonjour
or Android NSD discovery. The desktop companion is Rust.

## Run the desktop companion

On Omarchy, install the required runtime tools and then install the user service:

```bash
sudo pacman -S --needed rust wl-clipboard libnotify
./packaging/install-local.sh
omarchy-mobile status
omarchy-mobile pair
```

The installer builds both Rust binaries into `~/.local/bin`, installs a systemd
user unit, and starts it. Received content is placed in `~/Downloads/Omarchy Inbox`
when a Downloads directory is configured. Useful commands are:

```bash
omarchy-mobile status
omarchy-mobile revoke
omarchy-mobile inbox --open
journalctl --user -u omarchy-linkd -f
```

## Run the mobile app

This app contains custom native code and system share integrations, so Expo Go
is not sufficient. From `apps/mobile`:

```bash
npm ci
npx expo run:android
# or, on macOS:
npx expo run:ios
```

For an EAS development build, authenticate with Expo and connect the project
once with `eas init`, then run `eas build --profile development --platform all`.
Production profiles are defined in `apps/mobile/eas.json`; store credentials and
an Expo project ID intentionally remain account-owned and are not committed.

## Verify

```bash
cargo fmt --check
cargo test --workspace
cd apps/mobile
npm run typecheck
npx expo-doctor
```

The detailed product, architecture, security, platform, and release contracts
live in [`ai/specs`](ai/specs/README.md). Phase 1 is deliberately local-only;
the Cloudflare architecture documented there is future optional infrastructure.
