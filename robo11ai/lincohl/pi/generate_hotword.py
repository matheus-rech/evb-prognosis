#!/usr/bin/env python3
"""
Generate custom hotword references for Lincohl multi-personality system.

Records multiple samples for each wake word and creates reference files
that EfficientWord-Net uses for hotword detection.

Usage:
    python generate_hotword.py                    # Generate all hotwords
    python generate_hotword.py hey_lincohl        # Generate one specific hotword
    python generate_hotword.py --list             # Show available hotwords

Each hotword maps to a personality (see personalities.py).
"""

import os
import sys
import json
import time
import numpy as np
from pathlib import Path

from eff_word_net.streams import SimpleMicStream
from eff_word_net.audio_processing import Resnet50_Arc_loss

from personalities import PERSONALITIES

OUTPUT_DIR = Path("hotword_refs")
OUTPUT_DIR.mkdir(exist_ok=True)

NUM_SAMPLES = 5
WINDOW_LENGTH = 1.5  # seconds

base_model = Resnet50_Arc_loss()


def record_sample(sample_num: int, total: int) -> np.ndarray:
    """Record a single hotword sample from microphone."""
    mic = SimpleMicStream(
        window_length_secs=WINDOW_LENGTH,
        sliding_window_secs=0.75,
    )
    mic.start_stream()

    print(f"\n  Sample {sample_num}/{total}")
    input("  Press ENTER, then speak the hotword clearly...")
    print("  Recording... speak now!")

    time.sleep(0.3)
    frame = mic.getFrame()
    mic = None

    print("  Captured!")
    return frame


def generate_hotword(hotword_id: str, phrase: str):
    """Generate reference file for a single hotword."""
    output_file = OUTPUT_DIR / f"{hotword_id}_ref.json"

    print()
    print(f"  Hotword: \"{phrase}\"")
    print(f"  Personality: {PERSONALITIES[hotword_id]['name']}")
    print(f"  Output: {output_file}")
    print()
    print(f"  We'll record {NUM_SAMPLES} samples of you saying \"{phrase}\".")
    print("  Speak clearly in a normal voice, about 1 second per sample.")
    print("  Try slight variations in tone/speed for robustness.")
    print()
    input("  Press ENTER when ready...")

    embeddings = []
    for i in range(1, NUM_SAMPLES + 1):
        frame = record_sample(i, NUM_SAMPLES)
        embedding = base_model.vectorize(frame)
        embeddings.append(embedding.tolist())
        time.sleep(0.5)

    ref_data = {
        "hotword": hotword_id,
        "phrase": phrase,
        "embeddings": embeddings,
        "num_samples": len(embeddings),
        "model": "Resnet50_Arc_loss",
    }

    with open(output_file, "w") as f:
        json.dump(ref_data, f, indent=2)

    print(f"\n  Saved {output_file} ({len(embeddings)} samples)")
    return output_file


def main():
    print("=" * 55)
    print("  Lincohl -- Multi-Hotword Reference Generator")
    print("=" * 55)

    # Parse args
    if "--list" in sys.argv:
        print("\nAvailable hotwords:\n")
        for hid, p in PERSONALITIES.items():
            ref_file = OUTPUT_DIR / f"{hid}_ref.json"
            status = "trained" if ref_file.exists() else "NOT TRAINED"
            print(f"  {hid:20s}  \"{p['hotword_phrase']}\"  -> {p['name']:20s}  [{status}]")
        print()
        print("Usage:")
        print("  python generate_hotword.py              # Train all hotwords")
        print("  python generate_hotword.py hey_lincohl  # Train one hotword")
        return

    # Determine which hotwords to generate
    target_ids = []
    if len(sys.argv) > 1 and sys.argv[1] != "--list":
        target_id = sys.argv[1]
        if target_id not in PERSONALITIES:
            print(f"Error: Unknown hotword '{target_id}'")
            print(f"Available: {', '.join(PERSONALITIES.keys())}")
            sys.exit(1)
        target_ids = [target_id]
    else:
        target_ids = list(PERSONALITIES.keys())

    print(f"\nWill generate references for {len(target_ids)} hotword(s):\n")
    for hid in target_ids:
        p = PERSONALITIES[hid]
        print(f"  - \"{p['hotword_phrase']}\" -> {p['name']}")

    print()
    input("Press ENTER to begin...")

    generated = []
    for hid in target_ids:
        p = PERSONALITIES[hid]
        print()
        print("-" * 55)
        print(f"  [{target_ids.index(hid) + 1}/{len(target_ids)}] {p['name']}")
        print("-" * 55)

        output = generate_hotword(hid, p["hotword_phrase"])
        generated.append((hid, output))

    print()
    print("=" * 55)
    print("  DONE! Generated references:")
    print("=" * 55)
    for hid, path in generated:
        print(f"  {PERSONALITIES[hid]['hotword_phrase']:20s} -> {path}")

    print()

    # Check which are still missing
    missing = []
    for hid in PERSONALITIES:
        ref_file = OUTPUT_DIR / f"{hid}_ref.json"
        if not ref_file.exists():
            missing.append(hid)

    if missing:
        print(f"Still need training: {', '.join(missing)}")
        print("Run again with specific IDs to train them.")
    else:
        print("All hotwords trained! Run: python lincohl.py")


if __name__ == "__main__":
    main()
