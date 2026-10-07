import json
from pathlib import Path
import struct
import unittest

from reader import (UnsupportedProfile, read_format_entry, read_properties,
                    effective_style, decode_text)

EVIDENCE=json.loads((Path(__file__).parent/'evidence.json').read_text(encoding='utf-8'))
DEFAULTS={'urdu_font_slot':0,'size_units':24000,'weight':400,'italic':0,'alignment':1}
FONTS=[{'name':'Noori Nastaliq'},{'name':'Naskh'}]


def native_entries(sample):
    return [bytes.fromhex(e['hex']) for e in sample['excerpts'] if e['role']=='format-entry']


class NativeExcerptTests(unittest.TestCase):
    def test_all_native_envelopes_and_body_properties(self):
        for sample in EVIDENCE['samples']:
            with self.subTest(sample=sample['file']):
                entries=[]
                for raw in native_entries(sample):
                    entry,end=read_format_entry(raw,0,len(raw))
                    self.assertEqual(end,len(raw))
                    self.assertEqual(entry['outer_length'],entry['inner_length']+6)
                    # Independent reassembly from decoded fields and both
                    # length layers must reproduce each native byte exactly.
                    props=b''.join(bytes.fromhex(f['tag'])[::-1]+f['value'].to_bytes(f['width'],'little')
                                   for f in entry['properties'])
                    blob=struct.pack('<HI',entry['envelope_marker'],len(props))+props
                    rebuilt=struct.pack('<II',entry['span_value'],len(blob))+blob
                    self.assertEqual(rebuilt,raw)
                    entries.append(entry)
                self.assertEqual([e['span_value'] for e in entries],[1,42,1])
                actual=effective_style(entries[1],DEFAULTS,FONTS)
                for key,expected in sample['expected_body'].items():
                    self.assertEqual(actual[key],expected)

    def test_fractional_size_survives_without_rounding(self):
        sample=next(s for s in EVIDENCE['samples'] if s['file']=='06-size-11_5.inp')
        raw=native_entries(sample)[1]
        entry,unused=read_format_entry(raw,0,len(raw))
        self.assertEqual(effective_style(entry,DEFAULTS,FONTS)['font_size_pt'],11.5)

    def test_explicit_zero_alignment_beats_default_right(self):
        sample=next(s for s in EVIDENCE['samples'] if s['file']=='12-align-left.inp')
        raw=native_entries(sample)[1]
        entry,unused=read_format_entry(raw,0,len(raw))
        style=effective_style(entry,DEFAULTS,FONTS)
        self.assertEqual(style['explicit']['alignment'],0)
        self.assertEqual(style['alignment'],'left')

    def test_composition_has_distinct_bold_and_italic_fields(self):
        sample=next(s for s in EVIDENCE['samples'] if s['file']=='11-bold-italic.inp')
        raw=native_entries(sample)[1]
        entry,unused=read_format_entry(raw,0,len(raw))
        fields={f['tag']:f['value'] for f in entry['properties']}
        self.assertEqual(fields['7f02'],700)
        self.assertEqual(fields['7f03'],1)

    def test_normal_baseline_differs_from_trailing_cr(self):
        sample=EVIDENCE['samples'][0]
        entries=[read_format_entry(raw,0,len(raw))[0] for raw in native_entries(sample)]
        body=effective_style(entries[1],DEFAULTS,FONTS)
        cr=effective_style(entries[2],DEFAULTS,FONTS)
        self.assertEqual((body['font'],body['font_size_pt']),('Naskh',11))
        self.assertEqual((cr['font'],cr['font_size_pt']),('Noori Nastaliq',12))

    def test_every_truncated_native_entry_is_rejected(self):
        for sample in EVIDENCE['samples']:
            for raw in native_entries(sample):
                for length in range(len(raw)):
                    with self.assertRaises(UnsupportedProfile):
                        read_format_entry(raw[:length],0,length)

    def test_inner_length_cannot_escape_outer_envelope(self):
        raw=bytearray(native_entries(EVIDENCE['samples'][0])[1])
        struct.pack_into('<I',raw,10,2**32-1)
        with self.assertRaises(UnsupportedProfile):read_format_entry(raw,0,len(raw))

    def test_outer_length_cannot_escape_container(self):
        raw=bytearray(native_entries(EVIDENCE['samples'][0])[1])
        struct.pack_into('<I',raw,4,2**32-1)
        with self.assertRaises(UnsupportedProfile):read_format_entry(raw,0,len(raw))

    def test_unknown_property_width_is_not_guessed(self):
        raw=bytearray(native_entries(EVIDENCE['samples'][0])[1])
        struct.pack_into('<H',raw,20,0x7F99)
        with self.assertRaisesRegex(UnsupportedProfile,'unknown property width'):
            read_format_entry(raw,0,len(raw))

    def test_nonzero_base_reference_is_not_silently_inherited(self):
        raw=bytearray(native_entries(EVIDENCE['samples'][0])[1])
        struct.pack_into('<I',raw,16,1)
        with self.assertRaisesRegex(UnsupportedProfile,'base reference'):
            read_format_entry(raw,0,len(raw))

    def test_duplicate_property_is_rejected(self):
        props=bytes.fromhex('037f0100037f0000')
        with self.assertRaisesRegex(UnsupportedProfile,'duplicate'):
            read_properties(props,0,len(props))

    def test_unverified_weight_is_not_called_bold(self):
        entry={'properties':[{'name':'weight','value':500}]}
        with self.assertRaisesRegex(UnsupportedProfile,'weight'):
            effective_style(entry,DEFAULTS,FONTS)

    def test_missing_font_slot_does_not_shift_indices(self):
        entry={'properties':[{'name':'urdu_font_slot','value':1}]}
        with self.assertRaisesRegex(UnsupportedProfile,'font slot'):
            effective_style(entry,DEFAULTS,[{'name':'Noori Nastaliq'},{'name':''}])

    def test_unknown_glyph_is_not_discarded(self):
        with self.assertRaisesRegex(UnsupportedProfile,'glyph'):
            decode_text(bytes.fromhex('04ff0d'))

    def test_literal_space_pair_is_preserved(self):
        self.assertEqual(decode_text(bytes.fromhex('0481042004820d')),'ا ب\r')


if __name__=='__main__':unittest.main()
