#!/bin/bash
# Lincohl Pi - Setup Script
# Tested on Raspberry Pi OS (Bookworm) and Ubuntu 22.04

set -e

echo "========================================"
echo "  Lincohl Pi - Setup"
echo "========================================"

# System dependencies
echo "[1/5] Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    portaudio19-dev \
    libsndfile1 \
    libasound2-dev \
    alsa-utils \
    ffmpeg

# Python venv
echo "[2/5] Creating Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

# Python packages
echo "[3/5] Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

# Raspberry Pi GPIO (only on Pi)
if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model; then
    echo "[3.5/5] Detected Raspberry Pi -- installing GPIO..."
    pip install RPi.GPIO
fi

# Environment
echo "[4/5] Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created .env from .env.example"
    echo "  >> Edit .env and set your ELEVENLABS_API_KEY"
else
    echo "  .env already exists, skipping"
fi

# Directories
echo "[5/5] Creating directories..."
mkdir -p hotword_refs conversation_history

# Audio test
echo ""
echo "Testing audio devices..."
echo "  Input devices:"
python3 -c "import sounddevice; print(sounddevice.query_devices(kind='input'))" 2>/dev/null || echo "  (sounddevice not available, using PyAudio)"
echo ""

echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your ElevenLabs API key"
echo "  2. Generate hotwords: python generate_hotword.py"
echo "     (or one at a time: python generate_hotword.py hey_lincohl)"
echo "  3. Run agent:         python lincohl.py"
echo ""
