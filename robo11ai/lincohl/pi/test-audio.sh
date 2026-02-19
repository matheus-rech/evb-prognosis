#!/bin/bash
# Lincohl Pi - Audio Test
# Tests microphone input and speaker output to verify audio works
# before running the voice assistant.

echo "========================================"
echo "  Lincohl Pi - Audio Test"
echo "========================================"
echo ""

# Check audio system (PipeWire or PulseAudio)
echo "--- Audio system ---"
if command -v wpctl &>/dev/null; then
    echo "  PipeWire detected"
    echo ""
    echo "  Default sink (speaker):"
    wpctl inspect @DEFAULT_AUDIO_SINK@ 2>/dev/null | grep -E "node.name|node.description" | head -2 | sed 's/^/    /'
    echo ""
    echo "  Default source (mic):"
    wpctl inspect @DEFAULT_AUDIO_SOURCE@ 2>/dev/null | grep -E "node.name|node.description" | head -2 | sed 's/^/    /'
elif command -v pactl &>/dev/null; then
    echo "  PulseAudio detected"
    echo "  Default sink: $(pactl get-default-sink 2>/dev/null)"
    echo "  Default source: $(pactl get-default-source 2>/dev/null)"
else
    echo "  ALSA only (no PipeWire/PulseAudio)"
fi
echo ""

# Test speaker
echo "--- Speaker test ---"
echo "  Playing test tone (you should hear a sound)..."
if command -v speaker-test &>/dev/null; then
    timeout 3 speaker-test -t sine -f 440 -l 1 -p 1 2>/dev/null
    echo "  Did you hear a tone? If not, check speaker/volume."
else
    echo "  speaker-test not found. Install: sudo apt install alsa-utils"
fi
echo ""

# Test microphone
echo "--- Microphone test ---"
echo "  Recording 3 seconds of audio..."
TMPFILE=$(mktemp /tmp/lincohl-mic-test-XXXXXX.wav)
if arecord -d 3 -f cd "$TMPFILE" 2>/dev/null; then
    SIZE=$(stat -c%s "$TMPFILE" 2>/dev/null || stat -f%z "$TMPFILE" 2>/dev/null)
    echo "  Recorded: $TMPFILE ($SIZE bytes)"
    echo "  Playing back..."
    aplay "$TMPFILE" 2>/dev/null
    echo "  Did you hear your voice? If not, check mic input."
    rm -f "$TMPFILE"
else
    echo "  Recording failed. Check microphone connection."
    echo "  Available input devices:"
    arecord -l 2>/dev/null
    rm -f "$TMPFILE"
fi
echo ""

# Test PyAudio (what EfficientWord-Net uses)
echo "--- PyAudio test ---"
if [ -f .venv/bin/python3 ]; then
    .venv/bin/python3 -c "
import pyaudio
p = pyaudio.PyAudio()
print(f'  PyAudio version: {pyaudio.get_portaudio_version_text()}')
print(f'  Default input:  {p.get_default_input_device_info()[\"name\"]}')
print(f'  Default output: {p.get_default_output_device_info()[\"name\"]}')
print(f'  Input devices:')
for i in range(p.get_device_count()):
    d = p.get_device_info_by_index(i)
    if d['maxInputChannels'] > 0:
        rate = int(d['defaultSampleRate'])
        print(f'    [{i}] {d[\"name\"]} ({rate}Hz, {d[\"maxInputChannels\"]}ch)')
p.terminate()
print('  PyAudio: OK')
" 2>&1
else
    echo "  Activate venv first: source .venv/bin/activate"
fi
echo ""

echo "========================================"
echo "  Audio test complete!"
echo "========================================"
echo ""
echo "Recommended setup:"
echo "  - Mic: USB microphone (best) or Bluetooth HFP (limited)"
echo "  - Speaker: Bluetooth A2DP (great) or 3.5mm/USB"
echo ""
echo "If Bluetooth speaker is paired but not default:"
echo "  wpctl status                   # list sinks"
echo "  wpctl set-default <sink-id>    # set Bluetooth as default"
echo ""
