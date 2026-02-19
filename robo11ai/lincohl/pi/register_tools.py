#!/usr/bin/env python3
"""
Register client tool schemas on the ElevenLabs agent.

Patches the agent config to include client tool definitions so the LLM
knows what tools are available. Run once after changing tool schemas.

Usage:
    python register_tools.py          # Register tools
    python register_tools.py --dry    # Show payload without patching
"""

import os
import sys
import json

import requests as http_requests
from dotenv import load_dotenv

from client_tools import TOOL_SCHEMAS

load_dotenv()

AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "agent_3001kfda558fe46bse57atm3veb2")
API_KEY = os.getenv("ELEVENLABS_API_KEY")
BASE_URL = "https://api.elevenlabs.io/v1/convai/agents"

# System tools to preserve alongside our client tools
SYSTEM_TOOLS = [
    {"type": "system", "name": "end_call", "description": "End the conversation"},
    {"type": "system", "name": "language_detection", "description": "Detect the user's language"},
]


def get_current_agent_config() -> dict:
    """Fetch the current agent configuration."""
    resp = http_requests.get(
        f"{BASE_URL}/{AGENT_ID}",
        headers={"xi-api-key": API_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def register_tools(dry_run: bool = False) -> bool:
    """PATCH the agent to include client tool schemas + system tools."""
    if not API_KEY:
        print("ERROR: ELEVENLABS_API_KEY not set")
        return False

    # Build the tools list: system tools + our client tools
    all_tools = SYSTEM_TOOLS + TOOL_SCHEMAS

    payload = {
        "conversation_config": {
            "agent": {
                "tools": all_tools,
            }
        }
    }

    print(f"Agent: {AGENT_ID}")
    print(f"Tools to register: {len(all_tools)}")
    for tool in all_tools:
        print(f"  [{tool['type']}] {tool['name']} - {tool.get('description', '')[:60]}")

    if dry_run:
        print("\n--- Dry run payload ---")
        print(json.dumps(payload, indent=2))
        return True

    print("\nPatching agent...")
    resp = http_requests.patch(
        f"{BASE_URL}/{AGENT_ID}",
        json=payload,
        headers={"xi-api-key": API_KEY},
        timeout=15,
    )

    if resp.status_code == 200:
        print("Tools registered successfully.")
        return True
    else:
        print(f"ERROR: PATCH failed with {resp.status_code}")
        print(resp.text[:500])
        return False


def verify_tools():
    """Fetch agent config and print current tools."""
    if not API_KEY:
        print("ERROR: ELEVENLABS_API_KEY not set")
        return

    print(f"\nVerifying agent {AGENT_ID}...")
    config = get_current_agent_config()

    tools = (
        config.get("conversation_config", {})
        .get("agent", {})
        .get("tools", [])
    )

    if not tools:
        print("No tools configured on agent.")
    else:
        print(f"Agent has {len(tools)} tool(s):")
        for tool in tools:
            print(f"  [{tool.get('type', '?')}] {tool.get('name', '?')}")


if __name__ == "__main__":
    dry_run = "--dry" in sys.argv

    success = register_tools(dry_run=dry_run)

    if success and not dry_run:
        verify_tools()

    sys.exit(0 if success else 1)
