namespace InPage.Format;

/// <summary>
/// InPage → Unicode character mapping tables for v1/v2 (0x04-prefix encoding).
/// See specs/05-character-maps.md for full documentation.
/// </summary>
public static class CharMaps
{
    /// <summary>
    /// Composite sequences — MUST be matched BEFORE single-byte mappings.
    /// Key: (baseByte, modifierByte). Value: Unicode string.
    /// </summary>
    public static readonly IReadOnlyDictionary<(byte Base, byte Modifier), string> CompositeSequences =
        new Dictionary<(byte, byte), string>
        {
            { (0x81, 0xBF), "\u0623" },       // أ  Alef + Hamza Above
            { (0x81, 0xB3), "\u0622" },       // آ  Alef + Madda Above
            { (0xA2, 0xBF), "\u0624" },       // ؤ  Wao + Hamza Above
            { (0xA4, 0xBF), "\u06CC\u0626" }, // یئ Farsi Yeh + Hamza Above
        };

    /// <summary>
    /// Urdu byte-index → Unicode mapping table.
    /// The index is the second byte of a 04 XX pair.
    /// </summary>
    public static readonly IReadOnlyDictionary<byte, string> Urdu =
        new Dictionary<byte, string>
        {
            // Urdu/Arabic Letters
            { 0x81, "\u0627" }, // ا Alef
            { 0x82, "\u0628" }, // ب Beh
            { 0x83, "\u067E" }, // پ Peh
            { 0x84, "\u062A" }, // ت Teh
            { 0x85, "\u0679" }, // ٹ Tteh
            { 0x86, "\u062B" }, // ث Theh
            { 0x87, "\u062C" }, // ج Jeem
            { 0x88, "\u0686" }, // چ Tcheh
            { 0x89, "\u062D" }, // ح Hah
            { 0x8A, "\u062E" }, // خ Khah
            { 0x8B, "\u062F" }, // د Dal
            { 0x8C, "\u0688" }, // ڈ Ddal
            { 0x8D, "\u0630" }, // ذ Thal
            { 0x8E, "\u0631" }, // ر Reh
            { 0x8F, "\u0691" }, // ڑ Rreh
            { 0x90, "\u0632" }, // ز Zain
            { 0x91, "\u0698" }, // ژ Jeh
            { 0x92, "\u0633" }, // س Seen
            { 0x93, "\u0634" }, // ش Sheen
            { 0x94, "\u0635" }, // ص Sad
            { 0x95, "\u0636" }, // ض Dad
            { 0x96, "\u0637" }, // ط Tah
            { 0x97, "\u0638" }, // ظ Zah
            { 0x98, "\u0639" }, // ع Ain
            { 0x99, "\u063A" }, // غ Ghain
            { 0x9A, "\u0641" }, // ف Feh
            { 0x9B, "\u0642" }, // ق Qaf
            { 0x9C, "\u06A9" }, // ک Keheh (Urdu Kaf)
            { 0x9D, "\u06AF" }, // گ Gaf
            { 0x9E, "\u0644" }, // ل Lam
            { 0x9F, "\u0645" }, // م Meem
            { 0xA0, "\u0646" }, // ن Noon
            { 0xA1, "\u06BA" }, // ں Noon Ghunna
            { 0xA2, "\u0648" }, // و Wao
            { 0xA3, "\u0621" }, // ء Hamza
            { 0xA4, "\u06CC" }, // ی Farsi Yeh
            { 0xA5, "\u06D2" }, // ے Yeh Barree
            { 0xA6, "\u06C1" }, // ہ Heh Goal
            { 0xA7, "\u06BE" }, // ھ Heh Doachashmee
            { 0xB9, "\u06C3" }, // ۃ Teh Marbuta Goal

            // Diacritical Marks
            { 0xAA, "\u0650" }, // ِ Zer (Kasra)
            { 0xAB, "\u064E" }, // َ Zabar (Fatha)
            { 0xAC, "\u064F" }, // ُ Pesh (Damma)
            { 0xAD, "\u0651" }, // ّ Shadda
            { 0xA8, "\u064D" }, // ٍ Tanween Zer
            { 0xB0, "\u0656" }, // ٖ Khari Zer
            { 0xB1, "\u0652" }, // ْ Sukun
            { 0xB3, "\u0653" }, // ٓ Madda
            { 0xB5, "\u064C" }, // ٌ Tanween Pesh
            { 0xBD, "\u0670" }, // ٰ Khari Zabar (Superscript Alef)
            { 0xBE, "\u0657" }, // ٗ Ulta Pesh (Inverted Damma)
            { 0xBF, "\u0654" }, // ٔ Hamza Above
            { 0xC7, "\u064B" }, // ً Tanween Zabar (Fathatan)

            // Alternate Diacritic Encodings
            { 0xC1, "\u0657" }, // ٗ Inverted Damma (alt)
            { 0xC2, "\u0654" }, // ٔ Hamza Above (alt)
            { 0xC3, "\u0655" }, // ٕ Hamza Below (unique)
            { 0xC6, "\u0651" }, // ّ Shadda (alt)
            { 0xC9, "\u0670" }, // ٰ Superscript Alef (alt)
            { 0xCA, "\u0656" }, // ٖ Subscript Alef (alt)
            { 0xCC, "\u0614" }, // ؔ Sign Takhallus (alt)
            { 0xCD, "\u060C" }, // ، Arabic Comma (alt)

            // Special
            { 0xA9, "\u0640" }, // ـ Kashida
            { 0xB4, "" },       // Zero-width / null

            // Urdu Numerals (Extended Arabic-Indic)
            { 0xD0, "\u06F0" }, { 0xD1, "\u06F1" }, { 0xD2, "\u06F2" },
            { 0xD3, "\u06F3" }, { 0xD4, "\u06F4" }, { 0xD5, "\u06F5" },
            { 0xD6, "\u06F6" }, { 0xD7, "\u06F7" }, { 0xD8, "\u06F8" },
            { 0xD9, "\u06F9" },

            // Punctuation & Symbols
            { 0xDA, "!" },
            { 0xDB, "\uFD3E" }, // ﴾
            { 0xDC, "\uFD3F" }, // ﴿
            { 0xDF, "/" },
            { 0xE1, ")" },
            { 0xE2, "(" },
            { 0xE4, "+" },
            { 0xE8, "\u066D" }, // ٭
            { 0xE9, ":" },
            { 0xEA, "\u061B" }, // ؛
            { 0xEB, "\u00D7" }, // ×
            { 0xEC, "=" },
            { 0xED, "\u060C" }, // ،
            { 0xEE, "\u061F" }, // ؟
            { 0xEF, "\u00F7" }, // ÷
            { 0xF1, "/" },
            { 0xF2, "\u060E" }, // ؎
            { 0xF3, "\u06D4" }, // ۔
            { 0xF5, "-" },
            { 0xF6, "\uFDFA" }, // ﷺ
            { 0xF7, "\u0601" }, // ؁
            { 0xF8, "\u0610" }, // ؐ
            { 0xF9, "," },
            { 0xFA, "]" },
            { 0xFB, "[" },
            { 0xFC, "." },
            { 0xFD, "\u2018" }, // '
            { 0xFE, "\u2019" }, // '
            { 0x20, " " },

            // Religious Symbols
            { 0xAE, "\u0611" }, // ؑ
            { 0xCF, "\u0614" }, // ؔ
            { 0xE6, "\u0613" }, // ؓ
            { 0xE7, "\u0612" }, // ؒ
        };

    /// <summary>
    /// Arabic-mode overrides. In Arabic mode, these take precedence over Urdu.
    /// See specs/05-character-maps.md for the override table.
    /// </summary>
    public static readonly IReadOnlyDictionary<byte, string> ArabicOverrides =
        new Dictionary<byte, string>
        {
            { 0x9C, "\u0643" }, // ك Arabic Kaf
            { 0xA4, "\u064A" }, // ي Arabic Yeh
            { 0xA6, "\u0647" }, // ه Arabic Heh
            { 0xB8, "\u064A" }, // ي Arabic Yeh (alternate)

            // Arabic-Indic Digits 0–9
            { 0x7C, "\u0660" }, { 0x7D, "\u0661" }, { 0x7E, "\u0662" },
            { 0x7F, "\u0663" }, { 0x80, "\u0664" },
            { 0x81, "\u0665" }, { 0x82, "\u0666" }, { 0x83, "\u0667" },
            { 0x84, "\u0668" }, { 0x85, "\u0669" },
        };

    /// <summary>Returns true if the given Unicode code point is an Urdu/Arabic character.</summary>
    public static bool IsUrduCodePoint(int codePoint) =>
        (codePoint >= 0x0600 && codePoint <= 0x06FF) ||
        (codePoint >= 0x0750 && codePoint <= 0x077F) ||
        (codePoint >= 0xFB50 && codePoint <= 0xFDFF) ||
        (codePoint >= 0xFE70 && codePoint <= 0xFEFF) ||
        (codePoint >= 0x0610 && codePoint <= 0x061A) ||
        codePoint == 0xFDFA;

    /// <summary>Returns true if the given character is Urdu/Arabic.</summary>
    public static bool IsUrduChar(char c) => IsUrduCodePoint(c);
}
