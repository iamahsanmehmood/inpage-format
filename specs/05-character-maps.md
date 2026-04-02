# Character Mapping Tables

Complete byte-to-Unicode mapping tables for the InPage v1/v2 `0x04`-prefix encoding.

Each entry is the **second byte** of a `04 XX` pair. The first byte `0x04` is always the prefix and is not listed.

Sources: reverse engineering of `.INP` files, cross-referenced with multiple open-source converters.

---

## Composite Sequences

These 4-byte sequences (`04 <base> 04 <modifier>`) MUST be matched BEFORE single-byte lookups.

| Sequence | Unicode | Char | Description |
|---|---|---|---|
| `04 81 04 BF` | U+0623 | أ | Alef + Hamza Above |
| `04 81 04 B3` | U+0622 | آ | Alef + Madda Above |
| `04 A2 04 BF` | U+0624 | ؤ | Wao + Hamza Above |
| `04 A4 04 BF` | U+06CC U+0626 | یئ | Farsi Yeh + Hamza Above |

---

## Urdu/Arabic Letters

| Byte | Unicode | Char | Name |
|---|---|---|---|
| `0x81` | U+0627 | ا | Alef |
| `0x82` | U+0628 | ب | Beh |
| `0x83` | U+067E | پ | Peh |
| `0x84` | U+062A | ت | Teh |
| `0x85` | U+0679 | ٹ | Tteh (Urdu retroflex) |
| `0x86` | U+062B | ث | Theh |
| `0x87` | U+062C | ج | Jeem |
| `0x88` | U+0686 | چ | Tcheh |
| `0x89` | U+062D | ح | Hah |
| `0x8A` | U+062E | خ | Khah |
| `0x8B` | U+062F | د | Dal |
| `0x8C` | U+0688 | ڈ | Ddal (Urdu retroflex) |
| `0x8D` | U+0630 | ذ | Thal |
| `0x8E` | U+0631 | ر | Reh |
| `0x8F` | U+0691 | ڑ | Rreh (Urdu retroflex) |
| `0x90` | U+0632 | ز | Zain |
| `0x91` | U+0698 | ژ | Jeh |
| `0x92` | U+0633 | س | Seen |
| `0x93` | U+0634 | ش | Sheen |
| `0x94` | U+0635 | ص | Sad |
| `0x95` | U+0636 | ض | Dad |
| `0x96` | U+0637 | ط | Tah |
| `0x97` | U+0638 | ظ | Zah |
| `0x98` | U+0639 | ع | Ain |
| `0x99` | U+063A | غ | Ghain |
| `0x9A` | U+0641 | ف | Feh |
| `0x9B` | U+0642 | ق | Qaf |
| `0x9C` | U+06A9 | ک | Keheh (Urdu Kaf) |
| `0x9D` | U+06AF | گ | Gaf |
| `0x9E` | U+0644 | ل | Lam |
| `0x9F` | U+0645 | م | Meem |
| `0xA0` | U+0646 | ن | Noon |
| `0xA1` | U+06BA | ں | Noon Ghunna |
| `0xA2` | U+0648 | و | Wao |
| `0xA3` | U+0621 | ء | Hamza (standalone) |
| `0xA4` | U+06CC | ی | Farsi Yeh |
| `0xA5` | U+06D2 | ے | Yeh Barree |
| `0xA6` | U+06C1 | ہ | Heh Goal |
| `0xA7` | U+06BE | ھ | Heh Doachashmee |
| `0xB9` | U+06C3 | ۃ | Teh Marbuta Goal |

---

## Diacritical Marks (Harakat / Aeraab)

| Byte | Unicode | Name | Urdu Name |
|---|---|---|---|
| `0xAA` | U+0650 | Kasra | Zer (zer) |
| `0xAB` | U+064E | Fatha | Zabar (زبر) |
| `0xAC` | U+064F | Damma | Pesh (پیش) |
| `0xAD` | U+0651 | Shadda | Tashdeed (تشدید) |
| `0xA8` | U+064D | Kasratan | Tanween Zer |
| `0xB0` | U+0656 | Subscript Alef | Khari Zer |
| `0xB1` | U+0652 | Sukun | Jazm (جزم) |
| `0xB3` | U+0653 | Maddah Above | Madda |
| `0xB5` | U+064C | Dammatan | Tanween Pesh |
| `0xBD` | U+0670 | Superscript Alef | Khari Zabar |
| `0xBE` | U+0657 | Inverted Damma | Ulta Pesh |
| `0xBF` | U+0654 | Hamza Above | (primary mapping) |
| `0xC7` | U+064B | Fathatan | Tanween Zabar |

### Alternate Diacritic Encodings (0xC0–0xCF range)

Some InPage builds use alternate byte codes for diacritics. These are secondary mappings — the same Unicode code point, different byte.

| Byte | Unicode | Name | Primary byte |
|---|---|---|---|
| `0xC1` | U+0657 | Inverted Damma | `0xBE` |
| `0xC2` | U+0654 | Hamza Above | `0xBF` |
| `0xC3` | U+0655 | **Hamza Below** | *(unique — no other mapping)* |
| `0xC6` | U+0651 | Shadda | `0xAD` |
| `0xC9` | U+0670 | Superscript Alef | `0xBD` |
| `0xCA` | U+0656 | Subscript Alef | `0xB0` |
| `0xCC` | U+0614 | Sign Takhallus | `0xCF` |
| `0xCD` | U+060C | Arabic Comma | `0xED` |

> **Note on `0xC3`**: Arabic Hamza Below (U+0655) has no other byte mapping. If your decoder encounters `04 C3` and renders a wrong character, this entry is missing from your table.

---

## Urdu Numerals (Extended Arabic-Indic)

| Byte | Unicode | Char |
|---|---|---|
| `0xD0` | U+06F0 | ۰ |
| `0xD1` | U+06F1 | ۱ |
| `0xD2` | U+06F2 | ۲ |
| `0xD3` | U+06F3 | ۳ |
| `0xD4` | U+06F4 | ۴ |
| `0xD5` | U+06F5 | ۵ |
| `0xD6` | U+06F6 | ۶ |
| `0xD7` | U+06F7 | ۷ |
| `0xD8` | U+06F8 | ۸ |
| `0xD9` | U+06F9 | ۹ |

---

## Punctuation and Symbols

| Byte | Unicode | Char | Name |
|---|---|---|---|
| `0xA9` | U+0640 | ـ | Kashida / Tatweel |
| `0xB4` | (empty) | | Zero-width / null mapping |
| `0xDA` | U+0021 | ! | Exclamation Mark |
| `0xDB` | U+FD3E | ﴾ | Ornate Left Parenthesis |
| `0xDC` | U+FD3F | ﴿ | Ornate Right Parenthesis |
| `0xDF` | U+002F | / | Solidus (Slash) |
| `0xE1` | U+0029 | ) | Right Paren (RTL-swapped) |
| `0xE2` | U+0028 | ( | Left Paren (RTL-swapped) |
| `0xE4` | U+002B | + | Plus Sign |
| `0xE8` | U+066D | ٭ | Arabic Five-Pointed Star |
| `0xE9` | U+003A | : | Colon |
| `0xEA` | U+061B | ؛ | Arabic Semicolon |
| `0xEB` | U+00D7 | × | Multiplication Sign |
| `0xEC` | U+003D | = | Equals Sign |
| `0xED` | U+060C | ، | Arabic Comma |
| `0xEE` | U+061F | ؟ | Arabic Question Mark |
| `0xEF` | U+00F7 | ÷ | Division Sign |
| `0xF1` | U+002F | / | Forward Slash |
| `0xF2` | U+060E | ؎ | Poetic Verse Sign |
| `0xF3` | U+06D4 | ۔ | Urdu Full Stop |
| `0xF5` | U+002D | - | Hyphen-Minus |
| `0xF6` | U+FDFA | ﷺ | PBUH Ligature (ﷺ) |
| `0xF7` | U+0601 | ؁ | Sign Sanah (Year) |
| `0xF8` | U+0610 | ؐ | Sign Sallallahou |
| `0xF9` | U+002C | , | Comma |
| `0xFA` | U+005D | ] | Right Square Bracket |
| `0xFB` | U+005B | [ | Left Square Bracket |
| `0xFC` | U+002E | . | Full Stop (Period) |
| `0xFD` | U+2018 | ' | Left Single Quotation Mark |
| `0xFE` | U+2019 | ' | Right Single Quotation Mark |
| `0x20` | U+0020 | (space) | Space (alternate encoding) |

---

## Religious / Special Symbols

| Byte | Unicode | Char | Name |
|---|---|---|---|
| `0xAE` | U+0611 | ؑ | Sign Alef Above (Alayhis Salaam) |
| `0xCF` | U+0614 | ؔ | Sign Takhallus (poet's name marker) |
| `0xE6` | U+0613 | ؓ | Sign Radi Allahu Anhu |
| `0xE7` | U+0612 | ؒ | Sign Alayhe Assallam |

---

## Arabic Mode Overrides

When a document is in Arabic mode (as opposed to Urdu mode), these byte codes map to different characters:

| Byte | Urdu mode | Arabic mode | Reason |
|---|---|---|---|
| `0x9C` | U+06A9 ک Keheh | U+0643 ك Arabic Kaf | Different glyphs for Kaf |
| `0xA4` | U+06CC ی Farsi Yeh | U+064A ي Arabic Yeh | Different glyphs for Yeh |
| `0xA6` | U+06C1 ہ Heh Goal | U+0647 ه Arabic Heh | Different glyphs for Heh |
| `0xB8` | (unmapped) | U+064A ي Arabic Yeh | Arabic-only |
| `0x7C` | (unmapped) | U+0660 ٠ Arabic-Indic 0 | Digits 0–4 |
| `0x7D` | (unmapped) | U+0661 ١ Arabic-Indic 1 | |
| `0x7E` | (unmapped) | U+0662 ٢ Arabic-Indic 2 | |
| `0x7F` | (unmapped) | U+0663 ٣ Arabic-Indic 3 | |
| `0x80` | (unmapped) | U+0664 ٤ Arabic-Indic 4 | |
| `0x81` | U+0627 ا Alef | U+0665 ٥ Arabic-Indic 5 | Digit overrides letter |
| `0x82` | U+0628 ب Beh | U+0666 ٦ Arabic-Indic 6 | |
| `0x83` | U+067E پ Peh | U+0667 ٧ Arabic-Indic 7 | |
| `0x84` | U+062A ت Teh | U+0668 ٨ Arabic-Indic 8 | |
| `0x85` | U+0679 ٹ Tteh | U+0669 ٩ Arabic-Indic 9 | |

---

## Unmapped / Unknown Bytes

The following bytes have been observed in `.INP` files but their Unicode mapping is not yet confirmed:

| Byte | Observed in | Notes |
|---|---|---|
| `0xE3` | Various v1 files | Possibly a punctuation variant |
| `0xE5` | Various v1 files | Possibly a punctuation variant |
| `0xF0` | Various v1 files | Unknown |
| `0xF4` | Various v1 files | Unknown |
| `0xB2` | Arabic mode files | Possibly Arabic Yeh variant |
| `0xB6` | Some v2 files | Unknown |
| `0xB7` | Some v2 files | Unknown |

If you identify what any of these map to, please open an issue or PR (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
