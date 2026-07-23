#!/bin/bash
# Convenience wrapper — prefer: ./scripts/package.sh
exec "$(cd "$(dirname "$0")" && pwd)/scripts/package.sh" "$@"
