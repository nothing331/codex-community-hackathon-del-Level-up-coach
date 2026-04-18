#!/usr/bin/env python3
"""Download MathonGo JEE Main Physics PDFs into docs/mathongo/physics."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Dict, Iterable, List
from urllib.parse import parse_qs, urlparse, unquote
from urllib.request import HTTPSHandler, HTTPCookieProcessor, Request, build_opener

try:
    import certifi
except ImportError:  # pragma: no cover - certifi is optional at runtime.
    certifi = None


INDEX_URL = "https://www.mathongo.com/iit-jee/jee-main-chapter-wise-questions-with-solutions"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT_SECONDS = 60
MAX_RESOLUTION_STEPS = 8
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "docs" / "mathongo" / "physics"
DEFAULT_MANIFEST_PATH = DEFAULT_OUTPUT_DIR / "manifest.json"

PHYSICS_PAGE_RE = re.compile(
    r'href="(https://www\.mathongo\.com/iit-jee/'
    r'jee-main-physics-chapter-wise-questions-with-solutions-[^"]+)"'
)
DOWNLOAD_LINK_RE = re.compile(
    r'href="('
    r'https://(?:cutt\.ly|bit\.ly|links\.mathongo\.com|drive\.google\.com|drive\.usercontent\.google\.com)[^"]+'
    r'|https://www\.mathongo\.com/download/[^"]+'
    r')"'
)
META_REFRESH_RE = re.compile(
    r'<meta[^>]+http-equiv="refresh"[^>]+content="\d+;\s*url=([^"]+)"',
    re.IGNORECASE,
)
FILENAME_RE = re.compile(
    r"filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?",
    re.IGNORECASE,
)


def unique(items: Iterable[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def sanitize_filename(name: str) -> str:
    sanitized = re.sub(r'[<>:"/\\|?*]+', "-", name).strip().strip(".")
    return sanitized or "download.pdf"


def detect_drive_file_id(url: str) -> str | None:
    parsed = urlparse(url)
    if "drive.google.com" not in parsed.netloc and "drive.usercontent.google.com" not in parsed.netloc:
        return None

    match = re.search(r"/file/d/([^/]+)", parsed.path)
    if match:
        return match.group(1)

    query = parse_qs(parsed.query)
    if "id" in query and query["id"]:
        return query["id"][0]

    return None


def extract_filename(headers) -> str | None:
    content_disposition = headers.get("Content-Disposition")
    if not content_disposition:
        return None

    match = FILENAME_RE.search(content_disposition)
    if not match:
        return None

    return sanitize_filename(unquote(match.group(1) or match.group(2)))


def is_pdf_response(response) -> bool:
    content_type = (response.headers.get_content_type() or "").lower()
    if content_type == "application/pdf":
        return True

    content_disposition = (response.headers.get("Content-Disposition") or "").lower()
    if "attachment" in content_disposition and "filename" in content_disposition:
        return True

    return response.geturl().lower().endswith(".pdf")


def fetch_text(opener, url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_entry_content(html: str) -> str:
    start = html.find('<div class="entry-content"')
    if start != -1:
        html = html[start:]

    end = html.find('<div class="scriptlesssocialsharing"')
    if end != -1:
        html = html[:end]

    return html


def extract_physics_attempt_pages(html: str) -> List[str]:
    return unique(PHYSICS_PAGE_RE.findall(html))


def extract_download_links(page_html: str) -> List[str]:
    content = extract_entry_content(page_html)
    return unique(unescape(link) for link in DOWNLOAD_LINK_RE.findall(content))


def build_drive_download_url(file_id: str) -> str:
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def build_forced_mathongo_download_url(html: str) -> str | None:
    match = META_REFRESH_RE.search(html)
    if not match:
        return None
    return unescape(match.group(1))


def build_http_opener():
    handlers = [HTTPCookieProcessor()]
    if certifi is not None:
        context = ssl.create_default_context(cafile=certifi.where())
        handlers.append(HTTPSHandler(context=context))
    return build_opener(*handlers)


@dataclass
class DownloadResult:
    source_url: str
    resolved_url: str
    filename: str
    relative_path: str
    size_bytes: int
    reused_existing_file: bool


def choose_target_path(
    output_dir: Path,
    filename: str,
    source_url: str,
    existing_by_source: Dict[str, str],
    used_paths: Dict[str, str],
) -> Path:
    if source_url in existing_by_source:
        return output_dir / existing_by_source[source_url]

    filename = sanitize_filename(filename)
    candidate = output_dir / filename
    lower_candidate = candidate.name.lower()

    if lower_candidate not in used_paths:
        used_paths[lower_candidate] = source_url
        return candidate

    if used_paths[lower_candidate] == source_url:
        return candidate

    suffix = hashlib.sha1(source_url.encode("utf-8")).hexdigest()[:8]
    stem = candidate.stem
    extension = candidate.suffix or ".pdf"
    renamed = output_dir / f"{stem}-{suffix}{extension}"
    used_paths[renamed.name.lower()] = source_url
    return renamed


def resolve_and_download(
    opener,
    source_url: str,
    output_dir: Path,
    existing_by_source: Dict[str, str],
    used_paths: Dict[str, str],
    force: bool,
) -> DownloadResult:
    current_url = source_url
    last_html = ""

    for _ in range(MAX_RESOLUTION_STEPS):
        request = Request(current_url, headers={"User-Agent": USER_AGENT})
        with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            final_url = response.geturl()

            if is_pdf_response(response):
                filename = extract_filename(response.headers) or sanitize_filename(
                    Path(urlparse(final_url).path).name or "download.pdf"
                )
                if not filename.lower().endswith(".pdf"):
                    filename = f"{filename}.pdf"

                target_path = choose_target_path(
                    output_dir=output_dir,
                    filename=filename,
                    source_url=source_url,
                    existing_by_source=existing_by_source,
                    used_paths=used_paths,
                )
                reused_existing_file = target_path.exists() and not force

                if reused_existing_file:
                    size_bytes = target_path.stat().st_size
                else:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    data = response.read()
                    target_path.write_bytes(data)
                    size_bytes = len(data)

                return DownloadResult(
                    source_url=source_url,
                    resolved_url=final_url,
                    filename=target_path.name,
                    relative_path=target_path.relative_to(output_dir).as_posix(),
                    size_bytes=size_bytes,
                    reused_existing_file=reused_existing_file,
                )

            html = response.read().decode("utf-8", errors="replace")
            last_html = html

        forced_download_url = build_forced_mathongo_download_url(last_html)
        if forced_download_url:
            current_url = forced_download_url
            continue

        drive_file_id = detect_drive_file_id(final_url)
        if drive_file_id:
            current_url = build_drive_download_url(drive_file_id)
            continue

        raise RuntimeError(f"Could not resolve a PDF download from {source_url}")

    raise RuntimeError(f"Exceeded redirect resolution limit for {source_url}")


def load_existing_manifest(manifest_path: Path) -> Dict[str, str]:
    if not manifest_path.exists():
        return {}

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    existing: Dict[str, str] = {}
    for item in manifest.get("files", []):
        source_url = item.get("source_url")
        relative_path = item.get("relative_path")
        if source_url and relative_path:
            existing[source_url] = relative_path
    return existing


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory where PDFs will be written (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download files even if they already exist in the current manifest.",
    )
    return parser


def main() -> int:
    args = build_argument_parser().parse_args()
    output_dir = args.output_dir.resolve()
    manifest_path = output_dir / "manifest.json"
    output_dir.mkdir(parents=True, exist_ok=True)

    opener = build_http_opener()
    existing_by_source = {} if args.force else load_existing_manifest(manifest_path)
    used_paths = {Path(path).name.lower(): source for source, path in existing_by_source.items()}

    print(f"Fetching index: {INDEX_URL}")
    index_html = fetch_text(opener, INDEX_URL)
    attempt_pages = extract_physics_attempt_pages(index_html)
    print(f"Found {len(attempt_pages)} Physics attempt pages.")

    sources_to_pages: Dict[str, List[str]] = {}
    for page_url in attempt_pages:
        print(f"Scanning page: {page_url}")
        page_html = fetch_text(opener, page_url)
        links = extract_download_links(page_html)
        print(f"  found {len(links)} download links")
        for link in links:
            sources_to_pages.setdefault(link, []).append(page_url)

    source_urls = list(sources_to_pages)
    print(f"Resolved {len(source_urls)} unique download sources.")

    results: List[DownloadResult] = []
    failures: List[Dict[str, str]] = []

    for index, source_url in enumerate(source_urls, start=1):
        print(f"[{index}/{len(source_urls)}] Downloading {source_url}")
        try:
            result = resolve_and_download(
                opener=opener,
                source_url=source_url,
                output_dir=output_dir,
                existing_by_source=existing_by_source,
                used_paths=used_paths,
                force=args.force,
            )
        except Exception as exc:  # noqa: BLE001
            failures.append(
                {
                    "source_url": source_url,
                    "pages": sources_to_pages.get(source_url, []),
                    "error": str(exc),
                }
            )
            print(f"  failed: {exc}", file=sys.stderr)
            continue

        print(
            f"  saved {result.filename} "
            f"({result.size_bytes} bytes)"
            + (" [reused]" if result.reused_existing_file else "")
        )
        results.append(result)
        time.sleep(0.15)

    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "index_url": INDEX_URL,
        "output_dir": output_dir.as_posix(),
        "attempt_page_count": len(attempt_pages),
        "download_source_count": len(source_urls),
        "downloaded_file_count": len(results),
        "failure_count": len(failures),
        "attempt_pages": attempt_pages,
        "files": [
            {
                "source_url": result.source_url,
                "resolved_url": result.resolved_url,
                "filename": result.filename,
                "relative_path": result.relative_path,
                "size_bytes": result.size_bytes,
                "source_pages": sources_to_pages.get(result.source_url, []),
                "reused_existing_file": result.reused_existing_file,
            }
            for result in results
        ],
        "failures": failures,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Wrote manifest: {manifest_path}")
    print(f"Downloaded {len(results)} files with {len(failures)} failures.")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
