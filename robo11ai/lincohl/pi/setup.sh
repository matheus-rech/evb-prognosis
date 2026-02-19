#!/bin/bash
# Lincohl Pi - Setup Script
# Tested on Raspberry Pi OS (Bookworm) on Raspberry Pi 5

set -e

echo "========================================"
echo "  Lincohl Pi - Setup"
echo "========================================"

# System dependencies
echo "[1/6] Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    portaudio19-dev \
    libportaudio2 \
    libportaudiocpp0 \
    libsndfile1-dev \
    libasound2-dev \
    alsa-utils \
    ffmpeg \
    bluetooth \
    bluez \
    pulseaudio-module-bluetooth

# Python venv
echo "[2/6] Creating Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

# Python packages (install Pi ARM deps first, per official ElevenLabs guide)
echo "[3/6] Installing Python packages..."
pip install --upgrade pip
pip install tflite-runtime librosa  # ARM-specific, install before EfficientWord-Net
pip install -r requirements.txt

# Raspberry Pi GPIO (only on Pi)
if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model; then
    echo "[3.5/6] Detected Raspberry Pi -- installing GPIO..."
    pip install RPi.GPIO
fi

# Environment
echo "[4/6] Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created .env from .env.example"
    echo "  >> Edit .env and set your ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID"
else
    echo "  .env already exists, skipping"
fi

# Directories
echo "[5/6] Creating directories..."
mkdir -p hotword_refs conversation_history

# Audio setup
echo "[6/6] Checking audio devices..."
echo ""

# List input devices (microphones)
echo "--- Microphones (input) ---"
arecord -l 2>/dev/null || echo "  No ALSA capture devices found"
echo ""

# List output devices (speakers)
echo "--- Speakers (output) ---"
aplay -l 2>/dev/null || echo "  No ALSA playback devices found"
echo ""

# Check Bluetooth
echo "--- Bluetooth ---"
if systemctl is-active --quiet bluetooth; then
    echo "  Bluetooth service: running"
    echo "  Paired devices:"
    bluetoothctl devices Paired 2>/dev/null || echo "    (none)"
else
    echo "  Bluetooth service: not running"
    echo "  Start with: sudo systemctl enable --now bluetooth"
fi
echo ""

echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your ElevenLabs API key"
echo "  2. (Optional) Pair Bluetooth speaker: bash setup-bluetooth.sh"
echo "  3. Test audio: bash test-audio.sh"
echo "  4. Hotword ref already trained (oh_captain_ref.json)"
echo "     To retrain: python generate_hotword.py oh_captain"
echo "  5. Run agent: python lincohl.py"
echo ""
