#!/usr/bin/env python3
"""
Read-only download of Vercel deployment source snapshot.

Writes ONLY under cvresume-production-recovered/ (source/, logs/).
Does not redeploy, modify production, or touch other local project folders.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEPLOYMENT_ID = os.environ.get(
    "VERCEL_DEPLOYMENT_ID", "dpl_BoxHXvrqgFAxmBL4DtBHDxVCViBM"
)
TEAM_ID = os.environ.get("VERCEL_TEAM_ID", "team_1hXCUKm8UftAa3LEvG3LKtLn")
PRODUCTION_URL = os.environ.get(
    "VERCEL_PRODUCTION_URL", "https://tool.cv-by-design.com"
)

RECOVERY_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = RECOVERY_ROOT / "source"
LOG_DIR = RECOVERY_ROOT / "logs"

# Next.js app-router paths that must exist in a valid production snapshot.
REQUIRED_ROUTE_MARKERS: list[tuple[str, str]] = [
    ("Landing links to /login", "app/page.tsx"),
    ("Login page", "app/login/page.tsx"),
    ("Admin page", "app/admin/page.tsx"),
    ("Workspace route", "app/app/workspace/[slug]/page.tsx"),
    ("Auth login API", "app/api/auth/login/route.ts"),
    ("Auth logout API", "app/api/auth/logout/route.ts"),
    ("Auth me API", "app/api/auth/me/route.ts"),
    ("Folders API", "app/api/folders/route.ts"),
    ("LinkedIn sync API", "app/api/linkedin/sync/route.ts"),
    ("Admin accounts API", "app/api/admin/accounts/route.ts"),
]

LANDING_MARKERS = ("Sign in required", 'href="/login"')
LOGIN_MARKERS = ("Welcome back", "Sign in to access your workspace")


def log(msg: str, log_fp) -> None:
    line = f"[{datetime.now(timezone.utc).isoformat()}] {msg}"
    print(line)
    log_fp.write(line + "\n")
    log_fp.flush()


def api_get(path: str, token: str) -> bytes:
    url = f"https://api.vercel.com{path}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "cvresume-production-recovery/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def list_files(token: str) -> list:
    query = urllib.parse.urlencode({"teamId": TEAM_ID})
    path = f"/v6/deployments/{DEPLOYMENT_ID}/files?{query}"
    raw = api_get(path, token)
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected file tree response: {type(data).__name__}")
    return data


def download_file(uid: str, token: str) -> bytes:
    query = urllib.parse.urlencode({"teamId": TEAM_ID})
    path = f"/v8/deployments/{DEPLOYMENT_ID}/files/{uid}?{query}"
    raw = api_get(path, token)
    payload = json.loads(raw.decode("utf-8"))

    if isinstance(payload, dict):
        if "data" in payload:
            encoded = payload["data"]
        elif "content" in payload:
            encoded = payload["content"]
        else:
            raise RuntimeError(f"Unknown file payload keys: {sorted(payload.keys())}")
    elif isinstance(payload, str):
        encoded = payload
    else:
        raise RuntimeError(f"Unexpected file payload type: {type(payload).__name__}")

    return base64.b64decode(encoded)


def walk_tree(
    entries: list,
    rel_prefix: str,
    token: str,
    log_fp,
    stats: dict,
) -> None:
    for entry in entries:
        name = entry.get("name", "")
        entry_type = entry.get("type")
        rel_path = f"{rel_prefix}/{name}" if rel_prefix else name

        if entry_type == "directory":
            (SOURCE_DIR / rel_path).mkdir(parents=True, exist_ok=True)
            children = entry.get("children") or []
            walk_tree(children, rel_path, token, log_fp, stats)
            continue

        if entry_type != "file":
            stats["skipped_non_file"] += 1
            log(f"SKIP non-file entry: {rel_path} ({entry_type})", log_fp)
            continue

        uid = entry.get("uid")
        if not uid:
            stats["missing_uid"] += 1
            log(f"SKIP missing uid: {rel_path}", log_fp)
            continue

        dest = SOURCE_DIR / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)

        try:
            content = download_file(uid, token)
            dest.write_bytes(content)
            stats["downloaded"] += 1
            if stats["downloaded"] % 25 == 0:
                log(f"Downloaded {stats['downloaded']} files...", log_fp)
            time.sleep(0.05)
        except urllib.error.HTTPError as exc:
            stats["failed"] += 1
            log(f"FAIL {rel_path}: HTTP {exc.code} {exc.reason}", log_fp)
        except Exception as exc:  # noqa: BLE001 - keep going on per-file errors
            stats["failed"] += 1
            log(f"FAIL {rel_path}: {exc}", log_fp)


def verify_snapshot(log_fp) -> int:
    log("=== Verification: required production route files ===", log_fp)
    missing: list[str] = []

    for label, rel in REQUIRED_ROUTE_MARKERS:
        path = SOURCE_DIR / rel
        if path.is_file():
            log(f"OK   {label}: {rel}", log_fp)
        else:
            log(f"MISS {label}: {rel}", log_fp)
            missing.append(rel)

    landing = SOURCE_DIR / "app/page.tsx"
    if landing.is_file():
        text = landing.read_text(encoding="utf-8", errors="replace")
        for marker in LANDING_MARKERS:
            if marker in text:
                log(f"OK   landing marker: {marker!r}", log_fp)
            else:
                log(f"MISS landing marker: {marker!r}", log_fp)
                missing.append(f"app/page.tsx:{marker}")

    login = SOURCE_DIR / "app/login/page.tsx"
    if login.is_file():
        text = login.read_text(encoding="utf-8", errors="replace")
        for marker in LOGIN_MARKERS:
            if marker in text:
                log(f"OK   login marker: {marker!r}", log_fp)
            else:
                log(f"MISS login marker: {marker!r}", log_fp)
                missing.append(f"app/login/page.tsx:{marker}")

    file_count = sum(1 for _ in SOURCE_DIR.rglob("*") if _.is_file())
    log(f"Total files under source/: {file_count}", log_fp)

    manifest = {
        "deployment_id": DEPLOYMENT_ID,
        "team_id": TEAM_ID,
        "production_url": PRODUCTION_URL,
        "source_dir": str(SOURCE_DIR),
        "file_count": file_count,
        "missing": missing,
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }
    manifest_path = LOG_DIR / "verification.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    log(f"Wrote {manifest_path}", log_fp)

    if missing:
        log(f"VERIFICATION FAILED ({len(missing)} issue(s))", log_fp)
        return 1

    log("VERIFICATION PASSED", log_fp)
    return 0


def main() -> int:
    verify_only = "--verify-only" in sys.argv

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)

    log_path = LOG_DIR / f"download-{DEPLOYMENT_ID}.log"
    with log_path.open("a" if verify_only else "w", encoding="utf-8") as log_fp:
        if verify_only:
            log("Running verify-only mode (no Vercel API calls).", log_fp)
            return verify_snapshot(log_fp)

    token = os.environ.get("VERCEL_TOKEN", "").strip()
    if not token:
        print(
            "ERROR: Set VERCEL_TOKEN first.\n"
            "Create one at https://vercel.com/account/tokens (read access is enough).",
            file=sys.stderr,
        )
        return 2

    with log_path.open("w", encoding="utf-8") as log_fp:
        log(f"Recovery root: {RECOVERY_ROOT}", log_fp)
        log(f"Deployment ID: {DEPLOYMENT_ID}", log_fp)
        log(f"Production URL: {PRODUCTION_URL}", log_fp)
        log(f"Output dir: {SOURCE_DIR}", log_fp)

        try:
            tree = list_files(token)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            log(f"ERROR listing files: HTTP {exc.code} {exc.reason}", log_fp)
            log(body, log_fp)
            return 1
        except Exception as exc:  # noqa: BLE001
            log(f"ERROR listing files: {exc}", log_fp)
            return 1

        log(f"File tree entries at root: {len(tree)}", log_fp)

        stats = {
            "downloaded": 0,
            "failed": 0,
            "skipped_non_file": 0,
            "missing_uid": 0,
        }
        walk_tree(tree, "", token, log_fp, stats)

        log("=== Download summary ===", log_fp)
        for key, value in stats.items():
            log(f"{key}: {value}", log_fp)

        summary = {
            "deployment_id": DEPLOYMENT_ID,
            "stats": stats,
            "log": str(log_path),
            "source_dir": str(SOURCE_DIR),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }
        summary_path = LOG_DIR / "download-summary.json"
        summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        log(f"Wrote {summary_path}", log_fp)

        if stats["downloaded"] == 0:
            log("ERROR: No files downloaded.", log_fp)
            return 1

        return verify_snapshot(log_fp)


if __name__ == "__main__":
    raise SystemExit(main())
