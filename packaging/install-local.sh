#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd -- "${script_dir}/.." && pwd -P)"
bin_dir="${HOME}/.local/bin"
unit_dir="${HOME}/.config/systemd/user"

for command in cargo systemctl wl-copy wl-paste notify-send; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "${command}" >&2
    exit 1
  fi
done

cd -- "${repo_dir}"
cargo build --locked --release --package omarchy-linkd
install -Dm755 target/release/omarchy-linkd "${bin_dir}/omarchy-linkd"
install -Dm755 target/release/omarchy-mobile "${bin_dir}/omarchy-mobile"
install -Dm644 packaging/systemd/omarchy-linkd.service "${unit_dir}/omarchy-linkd.service"

systemctl --user daemon-reload
systemctl --user enable omarchy-linkd.service
systemctl --user restart omarchy-linkd.service

ready=false
for _ in {1..50}; do
  if "${bin_dir}/omarchy-mobile" status --json >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.1
done
if [[ "${ready}" != true ]]; then
  printf 'omarchy-linkd did not become ready; inspect it with: systemctl --user status omarchy-linkd\n' >&2
  exit 1
fi

printf '\nOmarchy Mobile desktop service is running.\n'
printf 'Pair a phone with: %s/omarchy-mobile pair\n' "${bin_dir}"
