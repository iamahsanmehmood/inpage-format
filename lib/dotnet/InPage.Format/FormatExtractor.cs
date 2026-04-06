using InPage.Format.Models;

namespace InPage.Format;

// ── Public types ──────────────────────────────────────────────────────────────

/// <summary>A font name entry found in the InPage stream header.</summary>
public sealed record FontEntry(int Index, string Name, int Offset);

/// <summary>A color palette entry found in the InPage stream.</summary>
public sealed record ColorEntry(string Name, byte R, byte G, byte B)
{
    /// <summary>Hex color string, e.g. "#ff0000".</summary>
    public string Hex => $"#{R:x2}{G:x2}{B:x2}";
}

/// <summary>Per-paragraph style override at a given text-start offset.</summary>
public sealed record ParagraphFormat(int TextStartOffset, StyleProperties Style);

/// <summary>All formatting metadata extracted from one InPage content stream.</summary>
public sealed record DocumentFormat(
    IReadOnlyList<FontEntry> Fonts,
    IReadOnlyList<ColorEntry> Colors,
    StyleProperties DefaultStyle,
    IReadOnlyList<ParagraphFormat> ParagraphFormats
);

// ── FormatExtractor ───────────────────────────────────────────────────────────

/// <summary>
/// Extracts formatting metadata from InPage content streams:
/// font table, color palette, default style (font size, alignment, bold),
/// and per-paragraph style overrides.
///
/// Based on reverse engineering of the .INP binary format.
/// See specs/06-formatting-structures.md for full documentation.
/// </summary>
public static class FormatExtractor
{
    /// <summary>InPage internal unit → typographic points (8.33 units ≈ 1 pt).</summary>
    private const double InPageUnitsPerPt = 8.33;

    /// <summary>Maximum font size accepted as a body-text default (pt).</summary>
    private const int MaxBodyFontSize = 24;

    private static readonly string[] FontPatterns =
    [
        "InPage", "Nastaliq", "Nastaleeq", "Arial", "Faiz", "Noori", "Jameel",
        "Gulzar", "Alvi", "Mehr", "Nafees", "Times", "Noto", "Tahoma", "Verdana",
        "Courier", "Symbol", "Helvetica", "Georgia",
    ];

    private static readonly string[] ColorNames =
    [
        "Black", "Blue", "Brown", "Crimson", "Cyan", "Gold", "Gray", "Grey",
        "Green", "Magenta", "Navy", "Orange", "Pink", "Purple", "Red",
        "Silver", "Teal", "Violet", "White", "Yellow", "Maroon", "Olive",
        "Dark", "Light", "Deep", "Sky", "Royal", "Lime", "Mint",
    ];

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>
    /// Extract all formatting metadata from an InPage content stream.
    /// </summary>
    /// <param name="data">Raw bytes of the InPage content stream (post-CFB extraction).</param>
    /// <param name="version">InPage version (1, 2, or 3).</param>
    public static DocumentFormat ExtractDocumentFormat(ReadOnlySpan<byte> data, int version) =>
        new(
            ExtractFontTable(data),
            ExtractColorPalette(data),
            ParseDefaultStyle(data),
            ExtractParagraphFormats(data, version)
        );

    /// <summary>
    /// Extract font names from the InPage stream header.
    /// Fonts are stored as UTF-16LE null-terminated strings.
    /// </summary>
    public static IReadOnlyList<FontEntry> ExtractFontTable(ReadOnlySpan<byte> data)
    {
        var fonts = new List<FontEntry>();
        var seenOffsets = new HashSet<int>();
        var byName = new Dictionary<string, FontEntry>(StringComparer.Ordinal);

        for (int i = 0; i < data.Length - 10; i += 2)
        {
            foreach (var pattern in FontPatterns)
            {
                if (!MatchesUtf16Le(data, i, pattern)) continue;
                if (seenOffsets.Contains(i)) break;

                var name = ReadUtf16LeString(data, i);
                if (name.Length < 3) break;

                seenOffsets.Add(i);
                if (!byName.ContainsKey(name))
                    byName[name] = new FontEntry(byName.Count, name, i);
                break;
            }
        }

        return byName.Values.ToList();
    }

    /// <summary>
    /// Extract color palette entries from the stream.
    /// Each entry is a UTF-16LE name string followed by 3 RGB bytes.
    /// </summary>
    public static IReadOnlyList<ColorEntry> ExtractColorPalette(ReadOnlySpan<byte> data)
    {
        var colors = new List<ColorEntry>();
        var seenOffsets = new HashSet<int>();

        for (int i = 0; i < data.Length - 60; i += 2)
        {
            foreach (var colorName in ColorNames)
            {
                if (!MatchesUtf16Le(data, i, colorName)) continue;
                if (seenOffsets.Contains(i)) break;

                seenOffsets.Add(i);
                var name = ReadUtf16LeString(data, i);
                if (name.Length < 2) break;

                // Skip null padding after the name
                int rgbOffset = i + name.Length * 2;
                while (rgbOffset < data.Length - 3 && data[rgbOffset] == 0x00 && data[rgbOffset + 1] == 0x00)
                    rgbOffset += 2;

                if (rgbOffset + 3 <= data.Length)
                    colors.Add(new ColorEntry(name, data[rgbOffset], data[rgbOffset + 1], data[rgbOffset + 2]));

                break;
            }
        }

        return colors;
    }

    /// <summary>
    /// Parse default style properties from the stream header.
    ///
    /// InPage stores default style properties as tag-value pairs starting around
    /// offset 0xD0, using [propId: u8][group: u8][value: u16 LE].
    ///
    /// Font size candidates above 24 pt are excluded — those are heading/display
    /// sizes that should not override the body-text default for all paragraphs.
    /// The mode (most common) body-size candidate is selected; ties prefer smaller.
    /// </summary>
    public static StyleProperties ParseDefaultStyle(ReadOnlySpan<byte> data)
    {
        if (data.Length < 0x160) return new StyleProperties();

        int scanEnd = Math.Min(data.Length - 4, 0x400);
        var fontSizeCandidates = new List<int>();

        int fontSize = 18;
        int fontIndex = 0;
        bool bold = false;
        bool italic = false;
        bool underline = false;
        int colorIndex = 0;
        Alignment alignment = Alignment.Right;
        double lineSpacing = 2.2;

        for (int i = 0; i < scanEnd; i += 2)
        {
            if (data[i + 1] != 0x01) continue;

            byte propId = data[i];
            int val = data[i + 2] | (data[i + 3] << 8);

            if (propId == 0x01)
            {
                int pts = (int)Math.Round(val / InPageUnitsPerPt);
                if (pts >= 4 && pts <= MaxBodyFontSize) fontSizeCandidates.Add(pts);
            }
            else
            {
                ApplyGroup01Property(propId, val, ref fontIndex, ref bold, ref italic, ref underline, ref colorIndex, ref alignment);
            }

            i += 2;
        }

        // Pick mode font size (most common); on tie, prefer smaller
        if (fontSizeCandidates.Count > 0)
        {
            var freq = new Dictionary<int, int>();
            foreach (var s in fontSizeCandidates)
                freq[s] = freq.TryGetValue(s, out int c) ? c + 1 : 1;

            int best = fontSizeCandidates[0];
            int bestCount = 0;
            foreach (var (size, count) in freq)
            {
                if (count > bestCount || (count == bestCount && size < best))
                {
                    best = size;
                    bestCount = count;
                }
            }
            fontSize = best;
        }

        return new StyleProperties(fontSize, fontIndex, bold, italic, underline, colorIndex, alignment, lineSpacing);
    }

    /// <summary>
    /// Extract per-paragraph style overrides from the stream.
    /// </summary>
    public static IReadOnlyList<ParagraphFormat> ExtractParagraphFormats(ReadOnlySpan<byte> data, int version) =>
        version >= 3 ? ExtractV3ParagraphFormats(data) : ExtractV1V2ParagraphFormats(data);

    /// <summary>
    /// Find the best-matching style for a given byte offset.
    /// Returns the closest preceding ParagraphFormat merged with the document default.
    /// </summary>
    public static StyleProperties GetStyleForOffset(
        int offset,
        IReadOnlyList<ParagraphFormat> formats,
        StyleProperties defaultStyle)
    {
        ParagraphFormat? best = null;
        foreach (var fmt in formats)
        {
            if (fmt.TextStartOffset <= offset)
            {
                if (best is null || fmt.TextStartOffset > best.TextStartOffset)
                    best = fmt;
            }
        }

        return best is null ? defaultStyle : Merge(defaultStyle, best.Style);
    }

    // ── Per-paragraph extraction ──────────────────────────────────────────────

    private static IReadOnlyList<ParagraphFormat> ExtractV1V2ParagraphFormats(ReadOnlySpan<byte> data)
    {
        var formats = new List<ParagraphFormat>();

        for (int i = 0; i < data.Length - 6; i++)
        {
            if (data[i] != 0x0D || data[i + 3] != 0x00 || data[i + 4] != 0x00
                || data[i + 5] != 0x09 || i + 6 >= data.Length || data[i + 6] != 0x04)
                continue;

            int textStart = i + 6;
            var overrides = new Dictionary<string, object?>();

            int scanStart = Math.Max(0, i - 80);
            int j = scanStart;
            while (j < i - 3)
            {
                byte propId = data[j];
                byte group = data[j + 1];
                int val = data[j + 2] | (data[j + 3] << 8);

                if (group == 0x01)
                {
                    ApplyGroup01ToDict(propId, val, overrides);
                    j += 4;
                }
                else if (group == 0x7E)
                {
                    ApplyGroup7EToDict(propId, val, overrides);
                    j += 4;
                }
                else
                {
                    j++;
                }
            }

            if (overrides.Count > 0)
                formats.Add(new ParagraphFormat(textStart, DictToStyle(overrides)));
        }

        return formats;
    }

    private static IReadOnlyList<ParagraphFormat> ExtractV3ParagraphFormats(ReadOnlySpan<byte> data)
    {
        var formats = new List<ParagraphFormat>();
        var currentOverrides = new Dictionary<string, object?>();
        int counter = 0;

        int i = 0;
        while (i < data.Length - 2)
        {
            ushort cp = (ushort)(data[i] | (data[i + 1] << 8));

            if (cp >= 0x0001 && cp <= 0x001F)
            {
                ParseV3InlineProperties(data, i + 2, currentOverrides);

                if (cp is 0x0004 or 0x000D)
                {
                    if (currentOverrides.Count > 0)
                    {
                        formats.Add(new ParagraphFormat(counter++, DictToStyle(currentOverrides)));
                        currentOverrides = [];
                    }
                }
            }

            i += 2;
        }

        return formats;
    }

    private static void ParseV3InlineProperties(ReadOnlySpan<byte> data, int offset, Dictionary<string, object?> overrides)
    {
        int end = Math.Min(data.Length, offset + 48);
        int i = offset;

        while (i + 4 <= end)
        {
            byte propId = data[i];
            byte group = data[i + 1];
            int val = data[i + 2] | (data[i + 3] << 8);

            if (group == 0x01)
            {
                ApplyGroup01ToDict(propId, val, overrides);
                i += 4;
            }
            else if (group == 0x7E)
            {
                ApplyGroup7EToDict(propId, val, overrides);
                i += 4;
            }
            else if (group == 0x03)
            {
                i += 4; // page-level, skip
            }
            else if (propId == 0x00 && group == 0x00)
            {
                break;
            }
            else
            {
                break;
            }
        }
    }

    // ── Property appliers ─────────────────────────────────────────────────────

    private static void ApplyGroup01Property(
        byte propId, int val,
        ref int fontIndex, ref bool bold, ref bool italic, ref bool underline,
        ref int colorIndex, ref Alignment alignment)
    {
        switch (propId)
        {
            case 0x03: fontIndex = val; break;
            case 0x04:
                if (val is 0 or 1 or 2 or 3)
                    alignment = (Alignment)val;
                break;
            case 0x0E: bold = val != 0; break;
        }
    }

    private static void ApplyGroup01ToDict(byte propId, int val, Dictionary<string, object?> d)
    {
        switch (propId)
        {
            case 0x01:
                int pts = (int)Math.Round(val / InPageUnitsPerPt);
                if (pts >= 4 && pts <= 400) d["fontSize"] = pts;
                break;
            case 0x03: d["fontIndex"] = val; break;
            case 0x04:
                if (val is 0 or 1 or 2 or 3) d["alignment"] = (Alignment)val;
                break;
            case 0x0E: d["bold"] = val != 0; break;
        }
    }

    private static void ApplyGroup7EToDict(byte propId, int val, Dictionary<string, object?> d)
    {
        switch (propId)
        {
            case 0x04:
                if (val > 0 && val is 1 or 2 or 3) d["alignment"] = (Alignment)val;
                break;
            case 0x05:
                int pts = (int)Math.Round(val / InPageUnitsPerPt);
                if (pts >= 4 && pts <= 400) d["fontSize"] = pts;
                break;
            case 0x0E: d["bold"] = val != 0; break;
            case 0x10: d["italic"] = val != 0; break;
            case 0x15:
                if (val < 256) d["colorIndex"] = val;
                break;
        }
    }

    // ── Style helpers ─────────────────────────────────────────────────────────

    private static StyleProperties DictToStyle(Dictionary<string, object?> d)
    {
        int fontSize = d.TryGetValue("fontSize", out var fs) ? (int)fs! : 18;
        int fontIndex = d.TryGetValue("fontIndex", out var fi) ? (int)fi! : 0;
        bool bold = d.TryGetValue("bold", out var b) && (bool)b!;
        bool italic = d.TryGetValue("italic", out var it) && (bool)it!;
        bool underline = d.TryGetValue("underline", out var ul) && (bool)ul!;
        int colorIndex = d.TryGetValue("colorIndex", out var ci) ? (int)ci! : 0;
        var alignment = d.TryGetValue("alignment", out var al) ? (Alignment)al! : Alignment.Right;
        return new StyleProperties(fontSize, fontIndex, bold, italic, underline, colorIndex, alignment);
    }

    private static StyleProperties Merge(StyleProperties defaults, StyleProperties overrides)
    {
        // Only override fields that differ from the StyleProperties default constructor
        var dflt = new StyleProperties();
        return defaults with
        {
            FontSize    = overrides.FontSize    != dflt.FontSize    ? overrides.FontSize    : defaults.FontSize,
            FontIndex   = overrides.FontIndex   != dflt.FontIndex   ? overrides.FontIndex   : defaults.FontIndex,
            Bold        = overrides.Bold        != dflt.Bold        ? overrides.Bold        : defaults.Bold,
            Italic      = overrides.Italic      != dflt.Italic      ? overrides.Italic      : defaults.Italic,
            Underline   = overrides.Underline   != dflt.Underline   ? overrides.Underline   : defaults.Underline,
            ColorIndex  = overrides.ColorIndex  != dflt.ColorIndex  ? overrides.ColorIndex  : defaults.ColorIndex,
            Alignment   = overrides.Alignment   != dflt.Alignment   ? overrides.Alignment   : defaults.Alignment,
        };
    }

    // ── UTF-16LE helpers ──────────────────────────────────────────────────────

    private static bool MatchesUtf16Le(ReadOnlySpan<byte> data, int offset, string pattern)
    {
        for (int j = 0; j < pattern.Length; j++)
        {
            int pos = offset + j * 2;
            if (pos + 1 >= data.Length) return false;
            if (data[pos] != pattern[j] || data[pos + 1] != 0x00) return false;
        }
        return true;
    }

    private static string ReadUtf16LeString(ReadOnlySpan<byte> data, int offset)
    {
        var sb = new System.Text.StringBuilder();
        int k = offset;
        while (k < data.Length - 1)
        {
            int cp = data[k] | (data[k + 1] << 8);
            if (cp == 0) break;
            if (cp > 127 && cp < 0x0600) break;
            sb.Append((char)cp);
            k += 2;
        }
        return sb.ToString();
    }
}
