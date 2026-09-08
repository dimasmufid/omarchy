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

To remove the companion, stop and disable the service, then remove its unit and
binaries. Revoke first if a phone is paired. The final command deletes the
desktop identity and cannot be undone; received inbox files are deliberately
left for the user to review and delete separately.

```bash
omarchy-mobile revoke --yes
systemctl --user disable --now omarchy-linkd.service
rm ~/.config/systemd/user/omarchy-linkd.service
rm ~/.local/bin/omarchy-linkd ~/.local/bin/omarchy-mobile
rm -r ~/.local/state/omarchy-mobile
systemctl --user daemon-reload
```

If the desktop firewall denies unsolicited LAN traffic, allow only the daemon's
TCP port from the current trusted LAN. Replace the example subnet with the one
reported by `ip route`; do not expose this port to every network:

```bash
sudo ufw allow proto tcp from 192.168.100.0/24 to any port 42783 \
  comment 'Omarchy Mobile LAN'
sudo ufw reload
```

Remove or replace that rule when the computer moves to a different LAN. Pairing
and every operation still require the certificate pin and paired-phone token;
the firewall rule alone grants no application access.

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
The shipped data behavior is summarized in [`PRIVACY.md`](PRIVACY.md), and the
remaining physical-device and account-owned gates are tracked in
[`ai/specs/release-checklist.md`](ai/specs/release-checklist.md).
Security issues should follow [`SECURITY.md`](SECURITY.md) and be reported
privately rather than through a public issue.
