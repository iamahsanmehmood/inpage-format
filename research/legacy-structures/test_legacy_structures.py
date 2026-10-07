"""Structural-reader bounds and losslessness tests; synthetic, not native proof."""
import struct
import unittest

from legacy_structures import (StructureError, read_directory_profile,
                               read_font_slots, read_sized_field)


class ReaderTests(unittest.TestCase):
    def directory(self):
        data = bytearray(100)
        for i, target in enumerate([58, 58, 60, 65, 80, 80, 100]):
            struct.pack_into("<HI", data, 16 + 6 * i, i, target)
        return data

    def font_block(self, names):
        records = []
        for name in names:
            area = (name + b"\0JUNK").ljust(32, b"\0")
            records.append(area + bytes(range(22)))
        block = b"".join(records)
        return struct.pack("<I", len(block)) + block

    def test_directory_allows_shared_boundaries(self):
        self.assertEqual([e["target"] for e in read_directory_profile(self.directory())],
                         [58, 58, 60, 65, 80, 80, 100])

    def test_directory_rejects_truncation(self):
        with self.assertRaises(StructureError):
            read_directory_profile(bytes(57))

    def test_directory_rejects_wrong_id(self):
        d = self.directory(); d[22] = 9
        with self.assertRaises(StructureError):
            read_directory_profile(d)

    def test_directory_rejects_descending_or_outside_offsets(self):
        for target in (57, 101):
            d = self.directory(); struct.pack_into("<I", d, 24, target)
            with self.assertRaises(StructureError):
                read_directory_profile(d)

    def test_directory_rejects_wrong_eof(self):
        d = self.directory(); struct.pack_into("<I", d, 54, 99)
        with self.assertRaises(StructureError):
            read_directory_profile(d)

    def test_font_slots_preserve_empty_duplicate_and_tail_bytes(self):
        result = read_font_slots(self.font_block([b"Arial", b"", b"Arial"]), 0)
        self.assertEqual([s["name_ascii"] for s in result["slots"]], ["Arial", "", "Arial"])
        self.assertEqual([s["slot"] for s in result["slots"]], [0, 1, 2])
        self.assertIn(b"JUNK".hex(), result["slots"][1]["name_area_hex"])
        self.assertEqual(result["slots"][0]["opaque_suffix_hex"], bytes(range(22)).hex())

    def test_font_names_do_not_guess_nonascii_encoding(self):
        slot = read_font_slots(self.font_block([b"\xe9"]), 0)["slots"][0]
        self.assertIsNone(slot["name_ascii"])
        self.assertEqual(slot["name_bytes_hex"], "e9")

    def test_font_length_rejects_nonmultiple_and_truncation(self):
        for d in (struct.pack("<I", 53) + bytes(53),
                  struct.pack("<I", 54) + bytes(53), struct.pack("<I", 0)):
            with self.assertRaises(StructureError):
                read_font_slots(d, 0)

    def test_font_name_requires_bounded_terminator(self):
        with self.assertRaises(StructureError):
            read_font_slots(struct.pack("<I", 54) + b"A" * 32 + bytes(22), 0)

    def test_sized_field(self):
        d = bytes.fromhex("e67f07000000") + b"Normal\0" + bytes.fromhex("e77f0100")
        self.assertEqual(read_sized_field(d, 0)["end_offset"], 13)
        self.assertEqual(read_sized_field(d, 0)["payload_hex"], b"Normal\0".hex())

    def test_sized_field_rejects_truncation_and_negative_offset(self):
        for d, p in ((bytes.fromhex("e67fffffff7f"), 0), (b"", -1)):
            with self.assertRaises(StructureError):
                read_sized_field(d, p)


if __name__ == "__main__":
    unittest.main()
