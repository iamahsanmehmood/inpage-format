"""Reproduce byte observations against a pinned, publicly available native file."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

from legacy_structures import read_directory_profile, read_font_slots, read_sized_field

HERE = Path(__file__).resolve().parent
FILE_SHA256 = "50281cde396c92d23d1b49e2196b8ac8ae4f9988ea8a01603779549a342cd0cf"
STREAM_SHA256 = "ea3152468b88562feca7296789051c7a83eb9e8c90a5186fd9516b86e14d280d"
SAMPLE_URL = ("https://raw.githubusercontent.com/KamalAbdali/InpageToUnicode/"
              "6eab0278d3717de98c230712121e4460266755b8/auxil/story.inp")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def verify_stream(data: bytes) -> dict:
    expected = json.loads((HERE / "evidence.json").read_text(encoding="utf-8"))
    require(len(data) == 87175, "Unexpected logical-stream size")
    require(hashlib.sha256(data).hexdigest() == STREAM_SHA256, "Stream SHA-256 mismatch")
    for excerpt in expected["excerpts"]:
        p = excerpt["offset"]
        raw = bytes.fromhex(excerpt["hex"])
        require(data[p:p + len(raw)] == raw, "Byte excerpt mismatch: " + excerpt["label"])
    directory = read_directory_profile(data)
    require([e["target"] for e in directory] == [6150, 6150, 6150, 6172, 87123, 87123, 87175],
            "Directory targets differ")
    a, b = directory[2]["target"], directory[3]["target"]
    require(data[a:b] == b"InPage Arabic Document", "Directory does not bracket the 22-byte label")
    a, b = directory[5]["target"], directory[6]["target"]
    require(data[a:b] == bytes.fromhex("fdffffff") + bytes(44) + bytes.fromhex("ffffffff"),
            "Directory does not bracket the 52-byte trailer")
    fonts = read_font_slots(data, 7413)
    names = [s["name_ascii"] for s in fonts["slots"]]
    require(names == ["Noori Nastaliq", "Naskh", "Firoz", "Arial", "Simplified Arabic",
                      "ZoharSindhi", "Sadaf"] + [""] * 11, "Font-slot names/positions differ")
    require(fonts["byte_length"] == 972 and fonts["end_offset"] == 8389,
            "Font block length or extent differs")
    # Independently rebuild all bytes, including data after NUL and empty slots.
    rebuilt = b"".join(bytes.fromhex(s["name_area_hex"] + s["opaque_suffix_hex"])
                       for s in fonts["slots"])
    require(rebuilt == data[7417:8389], "Font slots do not round-trip losslessly")
    field = read_sized_field(data, 7272)
    require(field["tag_hex"] == "e67f" and field["byte_length"] == 7
            and field["payload_hex"] == b"Normal\0".hex() and field["end_offset"] == 7285,
            "Length-prefixed field differs")
    require(data[7285:7287] == bytes.fromhex("e77f"), "Following tag differs")
    return {"status": "verified_against_pinned_native_sample",
            "file_sha256": FILE_SHA256, "stream_sha256": STREAM_SHA256,
            "stream": "InPage100", "stream_size": len(data),
            "directory": directory, "font_table": fonts, "sized_field": field,
            "exact_excerpts_checked": len(expected["excerpts"]),
            "native_rendering_or_resave": "not_performed",
            "coverage": "one public document; structure observations, not a general format specification"}


def load_sample(path: Path) -> bytes:
    require(path.stat().st_size == 92672, "Unexpected native-file size")
    blob = path.read_bytes()
    require(hashlib.sha256(blob).hexdigest() == FILE_SHA256, "Native-file SHA-256 mismatch")
    sys.path.insert(0, str(HERE / "vendor"))
    import olefile
    with olefile.OleFileIO(str(path), raise_defects=olefile.DEFECT_INCORRECT) as ole:
        require(ole.exists("InPage100"), "Missing InPage100 stream")
        return ole.openstream("InPage100").read()


def download_sample(path: Path) -> None:
    require(not path.exists(), "Download destination already exists")
    with urllib.request.urlopen(SAMPLE_URL, timeout=30) as response:
        blob = response.read(92673)
    require(len(blob) == 92672 and hashlib.sha256(blob).hexdigest() == FILE_SHA256,
            "Downloaded sample does not match the pinned file")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as out:
        out.write(blob)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="Existing pinned story.inp")
    source.add_argument("--download", type=Path, help="Download pinned sample to a NEW path")
    parser.add_argument("--report", type=Path, help="Write JSON to a NEW path; otherwise print it")
    args = parser.parse_args()
    try:
        if args.report:
            require(not args.report.exists(), "Report destination already exists")
        path = args.input or args.download
        if args.download:
            download_sample(path)
        report = verify_stream(load_sample(path))
        serialized = json.dumps(report, ensure_ascii=True, indent=2) + "\n"
        if args.report:
            with args.report.open("x", encoding="utf-8") as out:
                out.write(serialized)
            print("Verified pinned native sample; report written to " + str(args.report))
        else:
            print(serialized, end="")
        return 0
    except (OSError, ValueError, ImportError) as exc:
        print("Verification failed: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
