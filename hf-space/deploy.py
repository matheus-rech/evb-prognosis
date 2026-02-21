"""
CI deploy script: pushes code-only files from hf-space/ to a HF Space.
Model weights (LFS) are never touched — they stay in the Space repo.

Usage:
    python hf-space/deploy.py mmrech/evb-br
    python hf-space/deploy.py mmrech/evb-brazil
"""

import os
import sys
from pathlib import Path

from huggingface_hub import HfApi

DEPLOY_FILES = [
    "app.py",
    "requirements.txt",
    "README.md",
    "isotonic_calibration.json",
    "index.html",
    "evb_prognosis_complete.html",
    "evb_prognosis_mobile.html",
]


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python deploy.py <repo_id>")
        sys.exit(1)

    repo_id = sys.argv[1]
    token = os.environ.get("HF_TOKEN")
    if not token:
        print("HF_TOKEN environment variable is required")
        sys.exit(1)

    api = HfApi(token=token)
    space_dir = Path(__file__).parent

    for fname in DEPLOY_FILES:
        local = space_dir / fname
        if not local.exists():
            print(f"  skip {fname} (not found locally)")
            continue
        print(f"  uploading {fname} → {repo_id}")
        api.upload_file(
            path_or_fileobj=str(local),
            path_in_repo=fname,
            repo_id=repo_id,
            repo_type="space",
            commit_message=f"ci: auto-deploy {fname} from GitHub",
        )

    print(f"Done — {repo_id} updated.")


if __name__ == "__main__":
    main()
