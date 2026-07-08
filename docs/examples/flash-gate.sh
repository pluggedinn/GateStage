#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
gate_id="${1:?Usage: $0 <gate_id>   e.g. 1, 3, start, finish}"
exec esphome -s gate_id "$gate_id" run gate.yaml
