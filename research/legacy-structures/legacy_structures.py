"""Lossless readers for structures observed in one public InPage100 stream.

These are explicit-offset research readers, not general InPage format detection.
Offsets refer to the logical CFB stream. Unknown bytes remain in the result.
"""
from __future__ import annotations

import struct


class StructureError(ValueError):
    pass


def _span(data: bytes, offset: int, size: int) -> bytes:
    if offset < 0 or size < 0 or offset + size > len(data):
        raise StructureError("Structure extends outside the supplied stream")
    return data[offset:offset + size]


def read_directory_profile(data: bytes) -> list[dict]:
    """Read the observed seven <u16 id, u32 offset> entries at stream offset 16.

    Requiring ids 0..6, monotonic offsets, and terminal EOF is intentional:
    unrecognized variants fail rather than acquire unverified section meanings.
    """
    raw = _span(data, 16, 42)
    entries = []
    previous = 0
    for i in range(7):
        id_, target = struct.unpack_from("<HI", raw, i * 6)
        if id_ != i or not previous <= target <= len(data):
            raise StructureError("Not the observed directory profile")
        entries.append({"id": id_, "entry_offset": 16 + i * 6,
                        "target": target})
        previous = target
    if entries[-1]["target"] != len(data):
        raise StructureError("Terminal directory offset is not stream EOF")
    return entries


def read_font_slots(data: bytes, length_offset: int) -> dict:
    """Read a u32 byte length followed by 54-byte slots, at an explicit offset.

    Each observed slot has a 32-byte name area and 22 opaque bytes. Empty
    names, duplicate names, and bytes after the first NUL are preserved.
    Slot numbers are physical positions, not proven native font identifiers.
    """
    length = struct.unpack("<I", _span(data, length_offset, 4))[0]
    if not length or length % 54:
        raise StructureError("Font-block byte length must be a positive multiple of 54")
    block = _span(data, length_offset + 4, length)
    slots = []
    for index in range(length // 54):
        raw = block[index * 54:(index + 1) * 54]
        name_area = raw[:32]
        nul = name_area.find(b"\0")
        if nul == -1:
            raise StructureError("Observed font-name area requires a NUL terminator")
        name_bytes = name_area[:nul]
        try:
            name_ascii = name_bytes.decode("ascii")
        except UnicodeDecodeError:
            name_ascii = None  # no guessed code page
        slots.append({"slot": index, "offset": length_offset + 4 + index * 54,
                      "name_ascii": name_ascii, "name_bytes_hex": name_bytes.hex(),
                      "name_area_hex": name_area.hex(), "opaque_suffix_hex": raw[32:].hex()})
    return {"length_offset": length_offset, "byte_length": length,
            "record_width": 54, "end_offset": length_offset + 4 + length,
            "slots": slots}


def read_sized_field(data: bytes, offset: int) -> dict:
    """Read the observed <2-byte tag, u32 byte length, payload> pattern.

    Its general type system is unknown; only explicit offsets are supported.
    """
    raw = _span(data, offset, 6)
    length = struct.unpack_from("<I", raw, 2)[0]
    payload = _span(data, offset + 6, length)
    return {"offset": offset, "tag_hex": raw[:2].hex(), "byte_length": length,
            "payload_hex": payload.hex(), "end_offset": offset + 6 + length}
