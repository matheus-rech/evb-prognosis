#!/usr/bin/env python3
"""
Lincohl - Raspberry Pi Voice Agent (Multi-Hotword Edition)

EfficientWord-Net hotword detection + ElevenLabs Conversational AI
with personality switching via different wake words.

Wake words:
    "Oh Captain My Captain" -> Default assistant
    "Research mode"   -> Deep analytical mode
    "Code mode"       -> Staff engineer mode
    "Modo brasileiro" -> Full Portuguese mode
    "Casual mode"     -> Relaxed brainstorming

Agent: agent_3001kfda558fe46bse57atm3veb2
"""

import os
import sys
import json
import signal
import time
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from dotenv import load_dotenv

from eff_word_net.streams import SimpleMicStream
from eff_word_net.engine import HotwordDetector
from eff_word_net.audio_processing import Resnet50_Arc_loss

from elevenlabs.client import ElevenLabs
from elevenlabs.conversational_ai.conversation import (
    Conversation,
    ConversationInitiationData,
)
from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface

from personalities import PERSONALITIES, DEFAULT_HOTWORD
from client_tools import create_client_tools, TOOL_SCHEMAS

# Optional: sync server + agent PATCH
try:
    import requests as http_requests
    SYNC_AVAILABLE = True
except ImportError:
    SYNC_AVAILABLE = False

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "agent_3001kfda558fe46bse57atm3veb2")
API_KEY = os.getenv("ELEVENLABS_API_KEY")
SYNC_SERVER_URL = os.getenv("SYNC_SERVER_URL", "http://localhost:8420")

HOTWORD_THRESHOLD = float(os.getenv("HOTWORD_THRESHOLD", "0.7"))
HOTWORD_RELAXATION = float(os.getenv("HOTWORD_RELAXATION", "2.0"))

# Which personalities to listen for (comma-separated IDs, or "all")
ACTIVE_HOTWORDS = os.getenv("ACTIVE_HOTWORDS", "all")

# Max seconds to wait for a conversation session before force-ending (0 = no limit)
CONVERSATION_TIMEOUT = int(os.getenv("CONVERSATION_TIMEOUT", "300"))

# LED/GPIO feedback (optional, Raspberry Pi only)
LED_PIN = int(os.getenv("LED_PIN", "17"))

# Conversation history file
HISTORY_DIR = Path(os.getenv("HISTORY_DIR", "conversation_history"))
HISTORY_DIR.mkdir(exist_ok=True)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("lincohl")

# ---------------------------------------------------------------------------
# GPIO setup (graceful degradation if not on Pi)
# ---------------------------------------------------------------------------

try:
    import RPi.GPIO as GPIO

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(LED_PIN, GPIO.OUT)
    HAS_GPIO = True
    log.info("GPIO available -- LED on pin %d", LED_PIN)
except (ImportError, RuntimeError):
    HAS_GPIO = False
    log.info("GPIO not available -- LED feedback disabled")

# ---------------------------------------------------------------------------
# systemd watchdog / sd_notify (graceful degradation if sdnotify not installed)
# ---------------------------------------------------------------------------

try:
    import sdnotify
    _sd_notifier = sdnotify.SystemdNotifier()
    HAS_SDNOTIFY = True
    log.info("sdnotify available -- systemd watchdog enabled")
except ImportError:
    HAS_SDNOTIFY = False
    log.info("sdnotify not available -- systemd watchdog disabled")


def led_on():
    if HAS_GPIO:
        GPIO.output(LED_PIN, GPIO.HIGH)


def led_off():
    if HAS_GPIO:
        GPIO.output(LED_PIN, GPIO.LOW)


def led_blink(times=3, interval=0.15):
    if HAS_GPIO:
        for _ in range(times):
            GPIO.output(LED_PIN, GPIO.HIGH)
            time.sleep(interval)
            GPIO.output(LED_PIN, GPIO.LOW)
            time.sleep(interval)


# ---------------------------------------------------------------------------
# systemd notify helpers
# ---------------------------------------------------------------------------

def sd_ready():
    """Notify systemd the service is fully initialized."""
    if HAS_SDNOTIFY:
        _sd_notifier.notify("READY=1")
        _sd_notifier.notify("STATUS=Listening for wake words")


def sd_watchdog():
    """Send periodic watchdog heartbeat to systemd."""
    if HAS_SDNOTIFY:
        _sd_notifier.notify("WATCHDOG=1")


def sd_status(msg: str):
    """Update the service status string shown by systemctl status."""
    if HAS_SDNOTIFY:
        _sd_notifier.notify(f"STATUS={msg}")


# ---------------------------------------------------------------------------
# Personality PATCH -- switch agent config via ElevenLabs API
# ---------------------------------------------------------------------------

current_personality_id = DEFAULT_HOTWORD
_personality_lock = threading.Lock()


def patch_personality(personality_id: str) -> bool:
    """PATCH the ElevenLabs agent to use the given personality."""
    global current_personality_id

    with _personality_lock:
        if personality_id == current_personality_id:
            log.info("Already in %s mode, skipping PATCH", personality_id)
            return True

        if not SYNC_AVAILABLE or not API_KEY:
            log.warning("Cannot PATCH personality: requests library or API key missing")
            return False

        personality = PERSONALITIES[personality_id]
        log.info("Switching personality -> %s", personality["name"])

        payload = {
            "conversation_config": {
                "agent": {
                    "prompt": {
                        "prompt": personality["prompt"],
                        "temperature": personality["temperature"],
                    }
                }
            }
        }

        # Optionally change voice
        if personality.get("voice_id"):
            payload["conversation_config"]["tts"] = {
                "voice_id": personality["voice_id"]
            }

        try:
            resp = http_requests.patch(
                f"https://api.elevenlabs.io/v1/convai/agents/{AGENT_ID}",
                json=payload,
                headers={"xi-api-key": API_KEY},
                timeout=10,
            )
            if resp.status_code == 200:
                current_personality_id = personality_id
                log.info("Personality switched to: %s (temp: %.1f)",
                         personality["name"], personality["temperature"])
                return True
            else:
                log.error("PATCH failed: %d %s", resp.status_code, resp.text[:200])
                return False
        except Exception as e:
            log.error("PATCH error: %s", e)
            return False


# ---------------------------------------------------------------------------
# Sync server integration
# ---------------------------------------------------------------------------

class SyncClient:
    """Posts conversation events to the sync server."""

    def __init__(self, base_url: str, device_id: str = "raspberry-pi"):
        self.base_url = base_url.rstrip("/")
        self.device_id = device_id
        self.enabled = SYNC_AVAILABLE

    def post_event(self, event_type: str, data: dict):
        if not self.enabled:
            return
        try:
            payload = {
                "device": self.device_id,
                "event": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": data,
            }
            http_requests.post(
                f"{self.base_url}/api/events",
                json=payload,
                timeout=2,
            )
        except Exception:
            pass  # non-blocking, fire-and-forget

    def hotword_detected(self, hotword_name: str, personality: str):
        self.post_event("hotword_detected", {
            "hotword": hotword_name,
            "personality": personality,
        })

    def conversation_started(self, conversation_id: str = ""):
        self.post_event("conversation_started", {"conversation_id": conversation_id})

    def conversation_ended(self, conversation_id: str, messages: list):
        self.post_event(
            "conversation_ended",
            {"conversation_id": conversation_id, "messages": messages},
        )

    def user_transcript(self, text: str):
        self.post_event("user_transcript", {"text": text})

    def agent_response(self, text: str):
        self.post_event("agent_response", {"text": text})

    def personality_switched(self, personality_id: str, name: str):
        self.post_event("personality_switched", {
            "personality_id": personality_id,
            "name": name,
        })


sync = SyncClient(SYNC_SERVER_URL)

# ---------------------------------------------------------------------------
# Conversation history
# ---------------------------------------------------------------------------

class ConversationLogger:
    """Logs conversation turns to disk for RAG and review."""

    def __init__(self):
        self.current_messages: list[dict] = []
        self.conversation_id: str = ""

    def start(self):
        self.current_messages = []
        self.conversation_id = ""

    def add_user(self, text: str):
        entry = {
            "role": "user",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.current_messages.append(entry)
        sync.user_transcript(text)

    def add_agent(self, text: str):
        entry = {
            "role": "agent",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.current_messages.append(entry)
        sync.agent_response(text)

    def save(self, conversation_id: str):
        self.conversation_id = conversation_id
        if not self.current_messages:
            return

        filename = HISTORY_DIR / f"{conversation_id}.json"
        record = {
            "conversation_id": conversation_id,
            "device": "raspberry-pi",
            "personality": current_personality_id,
            "started_at": self.current_messages[0]["timestamp"],
            "ended_at": self.current_messages[-1]["timestamp"],
            "messages": self.current_messages,
        }
        with open(filename, "w") as f:
            json.dump(record, f, indent=2)
        log.info("Saved conversation %s (%d turns)", conversation_id, len(self.current_messages))
        sync.conversation_ended(conversation_id, self.current_messages)


conv_logger = ConversationLogger()

# ---------------------------------------------------------------------------
# ElevenLabs client
# ---------------------------------------------------------------------------

elevenlabs = ElevenLabs(api_key=API_KEY)

dynamic_vars = {
    "user_name": os.getenv("USER_NAME", "Matheus"),
    "greeting": os.getenv("GREETING", "Hey"),
    "agent_name": "Lincohl",
    "user_timezone": os.getenv("USER_TIMEZONE", "America/Sao_Paulo"),
}

config = ConversationInitiationData(
    dynamic_variables=dynamic_vars,
    conversation_config_override={
        "agent": {
            "prompt": {
                "tools": TOOL_SCHEMAS,
            }
        }
    },
)


def create_conversation() -> Conversation:
    """Create a new ElevenLabs conversation session."""
    conv_logger.start()

    return Conversation(
        elevenlabs,
        AGENT_ID,
        config=config,
        requires_auth=bool(API_KEY),
        audio_interface=DefaultAudioInterface(),
        client_tools=create_client_tools(),
        callback_agent_response=lambda r: (
            log.info("Agent: %s", r),
            conv_logger.add_agent(r),
        ),
        callback_agent_response_correction=lambda orig, corrected: (
            log.info("Agent correction: %s -> %s", orig, corrected),
        ),
        callback_user_transcript=lambda t: (
            log.info("User: %s", t),
            conv_logger.add_user(t),
        ),
        callback_latency_measurement=lambda ms: log.debug("Latency: %dms", ms),
    )


# ---------------------------------------------------------------------------
# Multi-hotword detection setup
# ---------------------------------------------------------------------------

base_model = Resnet50_Arc_loss()

# Determine which hotwords to activate
if ACTIVE_HOTWORDS.strip().lower() == "all":
    active_ids = list(PERSONALITIES.keys())
else:
    active_ids = [h.strip() for h in ACTIVE_HOTWORDS.split(",") if h.strip()]
    # Always include default
    if DEFAULT_HOTWORD not in active_ids:
        active_ids.insert(0, DEFAULT_HOTWORD)

# Build hotword detectors for each personality that has a trained ref file
hotword_detectors: list[tuple[str, HotwordDetector]] = []

for hid in active_ids:
    ref_path = os.path.join("hotword_refs", f"{hid}_ref.json")

    if os.path.exists(ref_path):
        detector = HotwordDetector(
            hotword=hid,
            model=base_model,
            reference_file=ref_path,
            threshold=HOTWORD_THRESHOLD,
            relaxation_time=HOTWORD_RELAXATION,
        )
        hotword_detectors.append((hid, detector))
        log.info("Loaded hotword: \"%s\" -> %s",
                 PERSONALITIES[hid]["hotword_phrase"],
                 PERSONALITIES[hid]["name"])
    else:
        log.warning("No reference for '%s' at %s -- skipping. "
                    "Run: python generate_hotword.py %s", hid, ref_path, hid)

# Fallback: if no custom refs exist at all, use built-in "alexa" for the default
if not hotword_detectors:
    from eff_word_net import samples_loc

    fallback_ref = os.path.join(samples_loc, "alexa_ref.json")
    detector = HotwordDetector(
        hotword=DEFAULT_HOTWORD,
        model=base_model,
        reference_file=fallback_ref,
        threshold=HOTWORD_THRESHOLD,
        relaxation_time=HOTWORD_RELAXATION,
    )
    hotword_detectors.append((DEFAULT_HOTWORD, detector))
    log.warning("No custom hotwords found -- using built-in 'alexa' as fallback")
    log.warning("Generate your hotwords with: python generate_hotword.py")

log.info("Active hotwords: %d", len(hotword_detectors))

# ---------------------------------------------------------------------------
# Mic stream management
# ---------------------------------------------------------------------------

mic_stream = None


def start_mic():
    global mic_stream
    try:
        mic_stream = SimpleMicStream(
            window_length_secs=1.5,
            sliding_window_secs=0.75,
        )
        mic_stream.start_stream()
        log.info("Microphone stream started")
    except Exception as e:
        log.error("Mic start failed: %s", e)
        mic_stream = None
        time.sleep(1)


def stop_mic():
    global mic_stream
    try:
        if mic_stream is not None:
            # Attempt to close the underlying PyAudio stream
            if hasattr(mic_stream, 'stream') and mic_stream.stream is not None:
                try:
                    mic_stream.stream.stop_stream()
                    mic_stream.stream.close()
                except Exception:
                    pass
            # Attempt to terminate the PyAudio instance
            if hasattr(mic_stream, 'audio') and mic_stream.audio is not None:
                try:
                    mic_stream.audio.terminate()
                except Exception:
                    pass
        mic_stream = None
        log.info("Microphone stream stopped")
    except Exception as e:
        log.error("Mic stop error: %s", e)
        mic_stream = None


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

convai_active = False
shutdown_requested = False


def handle_shutdown(sig, frame):
    global shutdown_requested
    log.info("Shutdown requested (signal %d)", sig)
    shutdown_requested = True


signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)


def main():
    global convai_active, mic_stream

    log.info("=" * 55)
    log.info("  LINCOHL - Raspberry Pi Voice Agent (Multi-Hotword)")
    log.info("  Agent: %s", AGENT_ID)
    log.info("  Active personalities:")
    for hid, _ in hotword_detectors:
        p = PERSONALITIES[hid]
        log.info("    \"%s\" -> %s (temp %.1f)",
                 p["hotword_phrase"], p["name"], p["temperature"])
    log.info("  User: %s", dynamic_vars["user_name"])
    log.info("  Sync server: %s", SYNC_SERVER_URL if SYNC_AVAILABLE else "disabled")
    log.info("=" * 55)
    log.info("Listening for wake words...")

    start_mic()
    if mic_stream is not None:
        sd_ready()
    else:
        log.error("Mic unavailable at startup -- systemd will restart")
        sys.exit(1)

    last_watchdog = time.monotonic()

    while not shutdown_requested:
        # Watchdog heartbeat — must run regardless of conversation state
        now = time.monotonic()
        if now - last_watchdog >= 10:
            sd_watchdog()
            last_watchdog = now

        if convai_active:
            time.sleep(0.1)
            continue

        try:
            if mic_stream is None:
                start_mic()
                continue

            frame = mic_stream.getFrame()

            # Check each hotword detector
            matched_id = None
            matched_confidence = 0.0

            for hid, detector in hotword_detectors:
                result = detector.scoreFrame(frame)
                if result is not None and result["match"]:
                    # Take the highest confidence match if multiple trigger
                    if result["confidence"] > matched_confidence:
                        matched_id = hid
                        matched_confidence = result["confidence"]

            if matched_id is None:
                continue

            personality = PERSONALITIES[matched_id]
            log.info("Hotword detected: \"%s\" (confidence: %.4f)",
                     personality["hotword_phrase"], matched_confidence)

            # Visual feedback -- different blink patterns per personality
            led_blink(personality.get("led_blinks", 2), 0.1)
            led_on()

            sync.hotword_detected(matched_id, personality["name"])

            # Switch personality if needed (PATCHes ElevenLabs agent)
            if matched_id != current_personality_id:
                success = patch_personality(matched_id)
                if success:
                    sync.personality_switched(matched_id, personality["name"])
                    log.info("Now in %s mode", personality["name"])

            # Stop mic to avoid conflicts with ElevenLabs audio
            stop_mic()

            # Start conversation
            sd_status("In conversation (%s)" % personality["name"])
            convai_active = True
            try:
                conversation = create_conversation()
                conversation.start_session()
                sync.conversation_started()

                # Wait for conversation to end with timeout to prevent
                # hanging forever if ElevenLabs becomes unresponsive
                conversation_id = None
                wait_result = [None]  # mutable container for thread result

                def _wait_session():
                    wait_result[0] = conversation.wait_for_session_end()

                wait_thread = threading.Thread(target=_wait_session, daemon=True)
                wait_thread.start()
                timeout = CONVERSATION_TIMEOUT if CONVERSATION_TIMEOUT > 0 else None
                wait_thread.join(timeout=timeout)

                if wait_thread.is_alive():
                    log.warning("Conversation timed out after %ds, ending session",
                                CONVERSATION_TIMEOUT)
                    try:
                        conversation.end_session()
                    except Exception:
                        pass
                    # Give the thread a moment to finish after end_session
                    wait_thread.join(timeout=5)
                    conversation_id = wait_result[0] or "timeout"
                else:
                    conversation_id = wait_result[0] or "unknown"

                log.info("Conversation ended: %s", conversation_id)

                # Save history
                conv_logger.save(conversation_id)

            except Exception as e:
                log.error("Conversation error: %s", e)
            finally:
                convai_active = False
                led_off()
                sd_status("Listening for wake words")
                time.sleep(1)
                start_mic()
                log.info("Ready for next wake word...")

        except Exception as e:
            log.error("Detection loop error: %s", e)
            mic_stream = None
            time.sleep(1)
            start_mic()

    # Cleanup
    sd_status("Shutting down")
    log.info("Shutting down...")
    stop_mic()
    led_off()
    if HAS_GPIO:
        GPIO.cleanup()


if __name__ == "__main__":
    main()
