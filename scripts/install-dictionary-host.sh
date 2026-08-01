#!/bin/zsh
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ '^[a-p]{32}$' ]]; then
  echo "Usage: $0 <extension-id-from-chrome://extensions>" >&2
  exit 2
fi

extension_id="$1"
script_dir="${0:A:h}"
project_dir="${script_dir:h}"
support_dir="$HOME/Library/Application Support/De-Slop"
host_manifest_dir="${DESLOP_NATIVE_MANIFEST_DIR:-$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts}"
host_binary="$support_dir/dictionary-host"
host_manifest="$host_manifest_dir/com.elou.deslop.dictionary.json"

mkdir -p "$support_dir" "$host_manifest_dir"
swiftc \
  "$project_dir/native/dictionary-host/main.swift" \
  -framework CoreServices \
  -o "$host_binary"
chmod 755 "$host_binary"

printf '%s\n' \
  '{' \
  '  "name": "com.elou.deslop.dictionary",' \
  '  "description": "Local macOS Dictionary lookup for De-Slop",' \
  "  \"path\": \"$host_binary\"," \
  '  "type": "stdio",' \
  "  \"allowed_origins\": [\"chrome-extension://$extension_id/\"]" \
  '}' > "$host_manifest"

echo "Installed the De-Slop Dictionary helper for extension $extension_id."
echo "Reload De-Slop from chrome://extensions before testing definitions."
