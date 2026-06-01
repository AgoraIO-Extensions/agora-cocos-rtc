#!/usr/bin/env zsh
# Capture [agora-rtc][log-ui] diagnostics from the booted iOS simulator.
set -euo pipefail

echo "Streaming [agora-rtc][log-ui] from booted simulator (Ctrl+C to stop)..."
echo "Reproduce: tap the top-right log button, then check touch-end / open-done lines."
echo

xcrun simctl spawn booted log stream --style compact 2>&1 | rg '\[agora-rtc\]\[log-ui\]|agora-rtc.*log-ui'
