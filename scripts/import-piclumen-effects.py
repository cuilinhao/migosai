#!/usr/bin/env python3
"""Import the explicitly captured public Effects catalog; never crawl or call an API.

The default input is the checked browser capture. If that ignored evidence file is
absent, the checked-in content catalog supplies the same explicit source URLs.
Existing complete assets are verified and reused on subsequent runs.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAPTURE = ROOT / ".local-evidence/piclumen-effects/original-catalog.json"
CATALOG = ROOT / "content/effects-catalog.json"
MANIFEST = ROOT / "docs/piclumen-effects/assets.json"
MEDIA = ROOT / "public/effects/piclumen"
PRECHECK = ROOT / ".local-evidence/piclumen-effects/media-preflight.json"
HEADERS = {"User-Agent": "MigosAI-local-preview-import/1.0"}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def get_catalog(source: Path) -> list[dict]:
    captured = json.loads(source.read_text())
    if not isinstance(captured, list) or not captured:
        raise ValueError("The input must be an explicit, nonempty array of captured effects.")
    catalog = []
    seen = set()
    for index, row in enumerate(captured, 1):
        for key in ("sourceVideo", "sourcePoster"):
            parsed = urllib.parse.urlsplit(row[key])
            if parsed.scheme != "https" or parsed.netloc != "publish.piclumen.com":
                raise ValueError(f"Unexpected media host in {key}: {row[key]}")
        if row["sourceVideo"] in seen:
            raise ValueError(f"Duplicate video: {row['sourceVideo']}")
        seen.add(row["sourceVideo"])
        slug = urllib.parse.urlsplit(row["sourcePage"]).path.strip("/").split("/")[-1]
        slug = re.sub(r"^effects?-", "", slug)
        slug = re.sub(r"[^a-z0-9-]", "-", slug.lower()).strip("-")
        identifier = f"{index:03d}-{slug}"
        poster_extension = Path(urllib.parse.urlsplit(row["sourcePoster"]).path).suffix.lower()
        if poster_extension not in (".webp", ".png", ".jpg", ".jpeg"):
            raise ValueError(f"Unexpected poster extension: {poster_extension}")
        catalog.append({
            "id": identifier,
            "title": row["title"],
            "description": row.get("description", ""),
            "video": f"/effects/piclumen/{identifier}.mp4",
            "poster": f"/effects/piclumen/{identifier}{poster_extension}",
            "isNew": bool(row.get("isNew", False)),
            "sourcePage": row["sourcePage"],
            "sourceVideo": row["sourceVideo"],
            "sourcePoster": row["sourcePoster"],
        })
    return catalog


def asset_rows(catalog: list[dict]) -> list[dict]:
    return [{"id": row["id"], "kind": kind, "source": row[source_key],
             "local": "public" + row[local_key]}
            for row in catalog
            for kind, source_key, local_key in (("video", "sourceVideo", "video"),
                                               ("poster", "sourcePoster", "poster"))]


def head(asset: dict) -> dict:
    for attempt in range(3):
        try:
            request = urllib.request.Request(asset["source"], headers=HEADERS, method="HEAD")
            with urllib.request.urlopen(request, timeout=40) as response:
                return {**asset, "status": response.status, "httpStatus": response.status,
                        "contentType": response.headers.get_content_type(),
                        "expectedBytes": int(response.headers.get("Content-Length", "0")),
                        "etag": response.headers.get("ETag")}
        except (OSError, urllib.error.URLError) as error:
            if attempt == 2:
                return {**asset, "status": "failed", "error": str(error)}
            time.sleep(attempt + 1)
    raise AssertionError("Unreachable")


def verify_media(path: Path, kind: str, expected_bytes: int) -> dict:
    size = path.stat().st_size
    if not size or (expected_bytes and size != expected_bytes):
        raise ValueError(f"Size mismatch for {path.name}: {size} != {expected_bytes}")
    checksum = hashlib.sha256(path.read_bytes()).hexdigest()
    if kind == "video":
        result = subprocess.run([
            "ffprobe", "-v", "error", "-count_packets", "-show_entries",
            "format=duration,size:stream=codec_type,codec_name,width,height,nb_read_packets",
            "-of", "json", str(path),
        ], capture_output=True, text=True, timeout=180, check=True)
        if result.stderr.strip():
            raise ValueError(result.stderr.strip())
        probe = json.loads(result.stdout)
        streams = probe.get("streams", [])
        video = next((stream for stream in streams if stream.get("codec_type") == "video"), None)
        if not video or int(video.get("nb_read_packets", "0")) < 1:
            raise ValueError(f"No readable video packets: {path.name}")
        return {"bytes": size, "sha256": checksum, "probe": probe}
    signature = path.read_bytes()[:16]
    valid = ((path.suffix == ".webp" and signature[:4] == b"RIFF" and signature[8:12] == b"WEBP")
             or (path.suffix == ".png" and signature[:8] == b"\x89PNG\r\n\x1a\n")
             or (path.suffix in (".jpg", ".jpeg") and signature[:3] == b"\xff\xd8\xff"))
    if not valid:
        raise ValueError(f"Invalid image header: {path.name}")
    return {"bytes": size, "sha256": checksum}


def download(asset: dict) -> dict:
    path = ROOT / asset["local"]
    path.parent.mkdir(parents=True, exist_ok=True)
    expected = asset.get("expectedBytes", 0)
    if path.exists():
        try:
            verified = verify_media(path, asset["kind"], expected)
            return {**asset, **verified, "status": "verified", "reused": True}
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    temporary = path.with_suffix(path.suffix + ".part")
    for attempt in range(4):
        try:
            request = urllib.request.Request(asset["source"], headers=HEADERS)
            with urllib.request.urlopen(request, timeout=90) as response, temporary.open("wb") as output:
                response_bytes = int(response.headers.get("Content-Length", "0"))
                shutil.copyfileobj(response, output, length=1024 * 1024)
                content_type = response.headers.get_content_type()
            temporary.replace(path)
            verified = verify_media(path, asset["kind"], response_bytes or expected)
            return {**asset, **verified, "status": "verified", "contentType": content_type, "reused": False}
        except (OSError, ValueError, urllib.error.URLError, subprocess.SubprocessError) as error:
            temporary.unlink(missing_ok=True)
            if attempt == 3:
                return {**asset, "status": "failed", "error": str(error)}
            time.sleep(attempt + 1)
    raise AssertionError("Unreachable")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=CAPTURE if CAPTURE.exists() else CATALOG)
    parser.add_argument("--workers", type=int, default=5, choices=range(1, 7))
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    catalog = get_catalog(args.input)
    write_json(CATALOG, catalog)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        preflight = list(pool.map(head, asset_rows(catalog)))
    write_json(PRECHECK, preflight)
    oversized = [row for row in preflight if row.get("expectedBytes", 0) > 24 * 1024 * 1024]
    failures = [row for row in preflight if row["status"] != 200]
    print(json.dumps({"effects": len(catalog), "assets": len(preflight),
                      "expectedBytes": sum(row.get("expectedBytes", 0) for row in preflight),
                      "oversized": oversized, "headFailures": failures}, ensure_ascii=False), flush=True)
    if args.preflight_only:
        return 1 if failures else 0
    if not shutil.which("ffprobe"):
        raise RuntimeError("ffprobe is required to verify every downloaded MP4.")
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        assets = []
        for index, asset in enumerate(pool.map(download, preflight), 1):
            assets.append(asset)
            if index % 10 == 0 or asset["status"] != "verified":
                print(f"{index}/{len(preflight)} {asset['status']} {asset['local']}", flush=True)
    write_json(MANIFEST, {
        "sourcePage": "https://www.piclumen.com/video-effects/",
        "capturedOn": "2026-10-22", "effects": len(catalog),
        "rights": "Source attribution only; no ownership or republication license is asserted.",
        "assets": assets,
    })
    failures = [row for row in assets if row["status"] != "verified"]
    print(json.dumps({"verified": len(assets) - len(failures), "failed": len(failures),
                      "totalBytes": sum(row.get("bytes", 0) for row in assets),
                      "largestBytes": max(row.get("bytes", 0) for row in assets)}, ensure_ascii=False), flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
