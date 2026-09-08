#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# ESPHome 2026.x (band_mode). Override with ESPHOME=... if needed.
ESPHOME="${ESPHOME:-$HOME/.pyenv/versions/3.11.4/bin/esphome}"

# Reuse object files across gate_id compiles (shared build_path in gate.yaml).
export IDF_CCACHE_ENABLE="${IDF_CCACHE_ENABLE:-1}"
export CCACHE_DIR="${CCACHE_DIR:-$(pwd)/.esphome/ccache}"
export PLATFORMIO_BUILD_CACHE_DIR="${PLATFORMIO_BUILD_CACHE_DIR:-$(pwd)/.esphome/pio-cache}"
mkdir -p "$CCACHE_DIR" "$PLATFORMIO_BUILD_CACHE_DIR"

usage() {
  echo "Usage: $0 <gate_id> [--device <ip-or-port>] [--no-logs] [--compile-only]"
  echo "  e.g. $0 3 --device 10.3.141.118 --no-logs"
}

gate_id=""
device=""
no_logs=0
compile_only=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --device)
      device="${2:?--device requires an IP or serial port}"
      shift 2
      ;;
    --no-logs)
      no_logs=1
      shift
      ;;
    --compile-only)
      compile_only=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      if [[ -n "$gate_id" ]]; then
        echo "Unexpected argument: $1" >&2
        usage
        exit 1
      fi
      gate_id="$1"
      shift
      ;;
  esac
done

if [[ -z "$gate_id" ]]; then
  usage
  exit 1
fi

cmd=("$ESPHOME" -s gate_id "$gate_id")
if [[ "$compile_only" -eq 1 ]]; then
  cmd+=(compile gate.yaml)
else
  cmd+=(run gate.yaml)
  if [[ -n "$device" ]]; then
    cmd+=(--device "$device")
  fi
  if [[ "$no_logs" -eq 1 ]]; then
    cmd+=(--no-logs)
  fi
fi
exec "${cmd[@]}"
