#!/bin/bash
# Lincohl Pi - Bluetooth Audio Setup
# Pairs a Bluetooth speaker for voice assistant output.
#
# Usage:
#   bash setup-bluetooth.sh          # Interactive scan + pair
#   bash setup-bluetooth.sh AA:BB:CC:DD:EE:FF  # Pair by MAC address

set -e

echo "========================================"
echo "  Lincohl Pi - Bluetooth Audio Setup"
echo "========================================"
echo ""

# Ensure bluetooth is running
if ! systemctl is-active --quiet bluetooth; then
    echo "Starting Bluetooth service..."
    sudo systemctl enable --now bluetooth
    sleep 2
fi

# If MAC address provided, pair directly
if [ -n "$1" ]; then
    MAC="$1"
    echo "Pairing with $MAC..."
    bluetoothctl trust "$MAC"
    bluetoothctl pair "$MAC" || true
    bluetoothctl connect "$MAC"
    echo ""
    echo "Connected to $MAC"
    echo "Testing audio output..."
    sleep 2
    speaker-test -t wav -c 2 -l 1 2>/dev/null && echo "Audio test passed!" || echo "Audio test failed - check speaker volume"
    exit 0
fi

# Interactive mode: scan and pair
echo "Put your Bluetooth speaker in pairing mode, then press ENTER..."
read -r

echo "Scanning for devices (10 seconds)..."
# Start scan, capture output, stop scan
bluetoothctl --timeout 10 scan on 2>/dev/null &
SCAN_PID=$!
sleep 10
kill $SCAN_PID 2>/dev/null || true

echo ""
echo "Available devices:"
bluetoothctl devices | nl
echo ""

echo "Enter the device number to pair (or 'q' to quit):"
read -r CHOICE

if [ "$CHOICE" = "q" ]; then
    echo "Cancelled."
    exit 0
fi

# Extract MAC from selection
MAC=$(bluetoothctl devices | sed -n "${CHOICE}p" | awk '{print $2}')
NAME=$(bluetoothctl devices | sed -n "${CHOICE}p" | cut -d' ' -f3-)

if [ -z "$MAC" ]; then
    echo "Invalid selection."
    exit 1
fi

echo ""
echo "Pairing with: $NAME ($MAC)..."
bluetoothctl trust "$MAC"
bluetoothctl pair "$MAC" || true
bluetoothctl connect "$MAC"

echo ""
echo "Setting as default audio output..."

# Wait for PulseAudio/PipeWire to register the device
sleep 3

# Try PipeWire (Pi OS Bookworm default) then PulseAudio
if command -v wpctl &>/dev/null; then
    # PipeWire: find the Bluetooth sink and set as default
    SINK_ID=$(wpctl status | grep -A 50 "Sinks:" | grep -i bluetooth | head -1 | awk '{print $1}' | tr -d '.*')
    if [ -n "$SINK_ID" ]; then
        wpctl set-default "$SINK_ID"
        echo "Set PipeWire default sink: $SINK_ID"
    else
        echo "Warning: Bluetooth sink not found in PipeWire yet"
        echo "Try: wpctl status | grep -i bluetooth"
    fi
elif command -v pactl &>/dev/null; then
    # PulseAudio fallback
    SINK=$(pactl list sinks short | grep -i bluetooth | head -1 | awk '{print $2}')
    if [ -n "$SINK" ]; then
        pactl set-default-sink "$SINK"
        echo "Set PulseAudio default sink: $SINK"
    else
        echo "Warning: Bluetooth sink not found in PulseAudio"
    fi
fi

echo ""
echo "Testing audio output..."
speaker-test -t wav -c 2 -l 1 2>/dev/null && echo "Audio test passed!" || echo "Audio test failed - check speaker volume"

echo ""
echo "========================================"
echo "  Bluetooth setup complete!"
echo "========================================"
echo "  Device: $NAME ($MAC)"
echo ""
echo "  To auto-connect on boot, the device is now trusted."
echo "  If it doesn't reconnect, run:"
echo "    bluetoothctl connect $MAC"
echo ""
