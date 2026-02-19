#!/usr/bin/env python3
"""
Lincohl RAG Manager
Manage the ElevenLabs knowledge base for the Lincohl agent.

Usage:
  python rag_manager.py list                  # List knowledge base docs
  python rag_manager.py upload FILE           # Upload a document
  python rag_manager.py upload-url URL NAME   # Upload from URL
  python rag_manager.py delete DOC_ID         # Delete a document
  python rag_manager.py sync DIR              # Sync a directory of docs

Supported formats: PDF, TXT, HTML, DOCX, EPUB
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_0f0f58d403553b356010b59a5024159151367ccc6ce01827")
AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "agent_3001kfda558fe46bse57atm3veb2")
BASE_URL = "https://api.elevenlabs.io/v1"

headers = {"xi-api-key": API_KEY}


def list_knowledge_base():
    """List all documents in the agent's knowledge base."""
    r = requests.get(f"{BASE_URL}/convai/agents/{AGENT_ID}", headers=headers)
    r.raise_for_status()
    agent = r.json()

    kb = agent.get("conversation_config", {}).get("agent", {}).get("prompt", {}).get("knowledge_base", [])

    if not kb:
        print("Knowledge base is empty.")
        return

    print(f"Knowledge base ({len(kb)} documents):")
    for doc in kb:
        doc_id = doc.get("id", "?")
        name = doc.get("name", "untitled")
        doc_type = doc.get("type", "?")
        print(f"  [{doc_type}] {name} (id: {doc_id})")


def upload_file(filepath: str):
    """Upload a file to the agent's knowledge base."""
    path = Path(filepath)
    if not path.exists():
        print(f"Error: {filepath} not found")
        sys.exit(1)

    print(f"Uploading {path.name}...")

    # Create knowledge base document
    r = requests.post(
        f"{BASE_URL}/convai/agents/{AGENT_ID}/add-to-knowledge-base",
        headers=headers,
        files={"file": (path.name, open(path, "rb"))},
    )
    r.raise_for_status()
    result = r.json()
    print(f"Uploaded: {path.name}")
    print(f"  Document ID: {result.get('id', 'unknown')}")
    return result


def upload_url(url: str, name: str):
    """Upload a URL to the agent's knowledge base."""
    print(f"Adding URL: {name} ({url})...")

    r = requests.post(
        f"{BASE_URL}/convai/agents/{AGENT_ID}/add-to-knowledge-base",
        headers=headers,
        data={"url": url, "name": name},
    )
    r.raise_for_status()
    result = r.json()
    print(f"Added: {name}")
    print(f"  Document ID: {result.get('id', 'unknown')}")
    return result


def delete_document(doc_id: str):
    """Delete a document from the knowledge base."""
    # Get current agent config
    r = requests.get(f"{BASE_URL}/convai/agents/{AGENT_ID}", headers=headers)
    r.raise_for_status()
    agent = r.json()

    kb = agent.get("conversation_config", {}).get("agent", {}).get("prompt", {}).get("knowledge_base", [])
    new_kb = [doc for doc in kb if doc.get("id") != doc_id]

    if len(new_kb) == len(kb):
        print(f"Document {doc_id} not found in knowledge base.")
        return

    # PATCH to remove
    r = requests.patch(
        f"{BASE_URL}/convai/agents/{AGENT_ID}",
        headers={**headers, "Content-Type": "application/json"},
        json={
            "conversation_config": {
                "agent": {
                    "prompt": {
                        "knowledge_base": new_kb
                    }
                }
            }
        },
    )
    r.raise_for_status()
    print(f"Deleted document: {doc_id}")


def sync_directory(dirpath: str):
    """Upload all supported files from a directory."""
    supported = {".pdf", ".txt", ".html", ".docx", ".epub", ".md"}
    path = Path(dirpath)

    if not path.is_dir():
        print(f"Error: {dirpath} is not a directory")
        sys.exit(1)

    files = [f for f in path.iterdir() if f.suffix.lower() in supported]

    if not files:
        print(f"No supported files found in {dirpath}")
        return

    print(f"Found {len(files)} files to upload:")
    for f in files:
        print(f"  - {f.name}")

    print()
    for f in files:
        try:
            upload_file(str(f))
            time.sleep(1)  # rate limit
        except Exception as e:
            print(f"  Error uploading {f.name}: {e}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "list":
        list_knowledge_base()
    elif cmd == "upload" and len(sys.argv) >= 3:
        upload_file(sys.argv[2])
    elif cmd == "upload-url" and len(sys.argv) >= 4:
        upload_url(sys.argv[2], sys.argv[3])
    elif cmd == "delete" and len(sys.argv) >= 3:
        delete_document(sys.argv[2])
    elif cmd == "sync" and len(sys.argv) >= 3:
        sync_directory(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
