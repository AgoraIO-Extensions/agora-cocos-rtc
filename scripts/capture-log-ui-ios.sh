#!/usr/bin/env zsh
# 抓取 iOS 模拟器里 [agora-rtc][log-ui] 诊断日志（先运行 App 并点击右上角「全部日志」）
set -euo pipefail

echo "Streaming [agora-rtc][log-ui] from booted simulator (Ctrl+C to stop)..."
echo "Reproduce: tap top-right 全部日志, then check touch-end / open-done lines."
echo

xcrun simctl spawn booted log stream --style compact 2>&1 | rg '\[agora-rtc\]\[log-ui\]|agora-rtc.*log-ui'
