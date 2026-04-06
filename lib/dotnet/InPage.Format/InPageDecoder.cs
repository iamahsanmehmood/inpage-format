using System.Text;
using InPage.Format.Models;

namespace InPage.Format;

/// <summary>
/// InPage text decoder for v1/v2 (0x04-prefix) and v3 (UTF-16LE) streams.
///
/// The caller must extract the raw content stream bytes from the OLE2/CFB
/// container (using OpenMcdf or similar) before calling these methods.
/// See specs/03-encoding-legacy.md and specs/04-encoding-v3.md.
/// </summary>
public static class InPageDecoder
{
    /// <summary>Sentinel string emitted in place of a Form Feed page break byte.</summary>
    public const string PageBreakMarker = "___PAGE_BREAK___";

    // ─── V1 / V2 ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Decode an InPage v1.x or v2.x content stream (0x04-prefix encoding).
    ///
    /// Word spacing recovery: non-0x04 control bytes between character
    /// sequences set a pendingSpace flag so the next decoded character is
    /// preceded by a space — recovering word boundaries stored implicitly.
    /// </summary>
    public static DecodeResult DecodeV1V2(ReadOnlySpan<byte> data)
    {
        var paragraphs = new List<string>();
        var pageBreakIndices = new List<int>();
        var meta = new List<ParagraphMeta>();

        var current = new StringBuilder();
        int paraStart = 0;
        bool pendingSpace = false;
        int i = 0;

        void Flush(int endOffset)
        {
            var trimmed = current.ToString().Trim();
            if (trimmed.Length > 0)
            {
                paragraphs.Add(trimmed);
                meta.Add(new ParagraphMeta(trimmed, paraStart, endOffset, false));
            }
            current.Clear();
            pendingSpace = false;
        }

        while (i < data.Length)
        {
            byte b = data[i];

            // Page break (Form Feed 0x0C)
            if (b == 0x0C)
            {
                Flush(i);
                paragraphs.Add(PageBreakMarker);
                pageBreakIndices.Add(paragraphs.Count - 1);
                meta.Add(new ParagraphMeta(PageBreakMarker, i, i + 1, true));
                i++;
                paraStart = i;
                continue;
            }

            // Paragraph break (CR 0x0D)
            if (b == 0x0D)
            {
                Flush(i);
                i += (i + 1 < data.Length && data[i + 1] == 0x0A) ? 2 : 1;
                paraStart = i;
                continue;
            }

            // Soft line break (LF 0x0A)
            if (b == 0x0A)
            {
                if (current.Length > 0 && current[current.Length - 1] != ' ')
                    current.Append(' ');
                pendingSpace = false;
                i++;
                continue;
            }

            // Tab
            if (b == 0x09)
            {
                current.Append('\t');
                pendingSpace = false;
                i++;
                continue;
            }

            // 0x04 prefix — character encoding
            if (b == 0x04 && i + 1 < data.Length)
            {
                byte charByte = data[i + 1];

                if (current.Length == 0) paraStart = i;

                // Insert word-boundary space if flagged
                if (pendingSpace && current.Length > 0 && current[current.Length - 1] != ' ')
                    current.Append(' ');
                pendingSpace = false;

                // Check composite sequence first (4-byte)
                if (i + 3 < data.Length && data[i + 2] == 0x04)
                {
                    byte modByte = data[i + 3];
                    if (CharMaps.CompositeSequences.TryGetValue((charByte, modByte), out var composite))
                    {
                        current.Append(composite);
                        i += 4;
                        continue;
                    }
                }

                // Single character lookup
                if (CharMaps.Urdu.TryGetValue(charByte, out var ch))
                    current.Append(ch);

                i += 2;
                continue;
            }

            // Unknown control byte — signals a potential word boundary
            if (current.Length > 0) pendingSpace = true;
            i++;
        }

        Flush(data.Length);
        return new DecodeResult(paragraphs, pageBreakIndices, meta);
    }

    // ─── V3 ──────────────────────────────────────────────────────────────────

    private readonly record struct TextSpan(int StyleId, int ByteLength);

    /// <summary>
    /// Decode an InPage v3 content stream (UTF-16LE with struct array).
    ///
    /// Locates the FF FF FF FF 0D 00 boundary marker, reads 8-byte
    /// [styleId, byteLength] structs backward from it, then iterates the
    /// text spans decoding UTF-16LE with CR paragraph breaks.
    /// </summary>
    public static DecodeResult DecodeV3(ReadOnlySpan<byte> data)
    {
        var paragraphs = new List<string>();
        var pageBreakIndices = new List<int>();
        var meta = new List<ParagraphMeta>();

        int arrayEnd = FindBoundaryMarker(data);
        if (arrayEnd < 0)
        {
            // Last resort: some V3 variants (e.g. multi-page InPage 3.x) store text
            // directly without the struct-array/boundary-marker format. Scan the
            // entire stream for contiguous UTF-16LE Urdu regions and decode them.
            Console.Error.WriteLine("[DecodeV3] Boundary marker not found. Trying direct UTF-16LE scan fallback...");
            return DecodeV3Fallback(data);
        }

        int textStart = arrayEnd + 6;

        // Read struct array backward from boundary marker
        var structs = new List<TextSpan>();
        int pos = arrayEnd - 8;
        while (pos >= 0)
        {
            int styleId = ReadInt32LE(data, pos);
            int byteLen = ReadInt32LE(data, pos + 4);

            if (styleId > 1000 || byteLen > 100_000 || (styleId == 0 && byteLen == 0))
                break;

            structs.Insert(0, new TextSpan(styleId, byteLen));
            pos -= 8;
        }

        // Decode spans
        int cursor = textStart;
        var current = new StringBuilder();
        int paraStart = cursor;
        int paraStyleId = structs.Count > 0 ? structs[0].StyleId : 0;

        foreach (var span in structs)
        {
            if (cursor + span.ByteLength > data.Length) break;

            var chunk = data.Slice(cursor, span.ByteLength);
            int ci = 0;

            while (ci + 1 < chunk.Length)
            {
                ushort cp = (ushort)(chunk[ci] | (chunk[ci + 1] << 8));

                // Skip control code injection records
                bool isCtrl = (cp >= 0x0001 && cp <= 0x001F &&
                               cp != 0x000D && cp != 0x0009 && cp != 0x000A) || cp == 0x007E;
                if (isCtrl && ci + 3 < chunk.Length)
                {
                    int recordLen = chunk[ci + 2] | (chunk[ci + 3] << 8);
                    ci += 4 + recordLen;
                    continue;
                }

                if (cp == 0x000D)
                {
                    var trimmed = current.ToString().Trim('\r').Trim();
                    paragraphs.Add(trimmed);
                    meta.Add(new ParagraphMeta(trimmed, paraStart, cursor + ci, false, paraStyleId));
                    current.Clear();
                    paraStart = cursor + ci + 2;
                    paraStyleId = span.StyleId;
                }
                else if (cp >= 0x0020 || cp == 0x0009 || cp == 0x000A)
                {
                    if (current.Length == 0) paraStyleId = span.StyleId;
                    current.Append((char)cp);
                }

                ci += 2;
            }

            cursor += span.ByteLength;
        }

        // Flush remaining
        var remaining = current.ToString().Trim();
        if (remaining.Length > 0)
        {
            paragraphs.Add(remaining);
            meta.Add(new ParagraphMeta(remaining, paraStart, cursor, false, paraStyleId));
        }

        return new DecodeResult(paragraphs, pageBreakIndices, meta);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static int FindBoundaryMarker(ReadOnlySpan<byte> data)
    {
        // First pass: scan from 0x1000 (covers ~95% of files)
        int result = ScanForMarker(data, Math.Min(0x1000, data.Length), data.Length);
        if (result >= 0) return result;

        // Fallback: scan from 0 to 0x1000
        Console.Error.WriteLine("[DecodeV3] Boundary marker not found at 0x1000+, scanning from start...");
        return ScanForMarker(data, 0, Math.Min(data.Length, 0x1000));
    }

    private static int ScanForMarker(ReadOnlySpan<byte> data, int from, int to)
    {
        for (int i = from; i < to - 5; i += 2)
        {
            if (data[i] == 0xFF && data[i + 1] == 0xFF &&
                data[i + 2] == 0xFF && data[i + 3] == 0xFF &&
                data[i + 4] == 0x0D && data[i + 5] == 0x00)
            {
                return i;
            }
        }
        return -1;
    }

    private static int ReadInt32LE(ReadOnlySpan<byte> data, int offset) =>
        data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24);

    // ─── V3 Fallback ─────────────────────────────────────────────────────────

    /// <summary>
    /// Fallback decoder for V3 files that lack the standard FF FF FF FF 0D 00
    /// boundary marker.
    ///
    /// Some InPage 3.x variants store text in multiple page-sized blocks rather
    /// than a single linearised stream. Strategy: find all contiguous UTF-16LE
    /// Urdu/Arabic text regions (≥ 20 consecutive Urdu code points), decode each
    /// as plain paragraphs split on CR, and concatenate the results.
    ///
    /// Yields text without style metadata but prevents blank output.
    /// </summary>
    private static DecodeResult DecodeV3Fallback(ReadOnlySpan<byte> data)
    {
        const int MinRun = 20; // min consecutive Urdu chars to qualify as real text

        var paragraphs = new List<string>();
        var pageBreakIndices = new List<int>();
        var meta = new List<ParagraphMeta>();

        // Collect Urdu run boundaries first (can't capture span in local fn)
        var runs = new List<(int From, int To)>();
        int runStart = -1;
        int urduCount = 0;

        for (int i = 0; i < data.Length - 1; i += 2)
        {
            ushort cp = (ushort)(data[i] | (data[i + 1] << 8));
            bool isUrduLike = (cp >= 0x0600 && cp <= 0x06FF) || cp == 0x0020 || cp == 0x000D || cp == 0x0009;

            if (isUrduLike)
            {
                if (runStart == -1) runStart = i;
                if (cp >= 0x0600 && cp <= 0x06FF) urduCount++;
            }
            else
            {
                if (runStart >= 0 && urduCount >= MinRun)
                    runs.Add((runStart, i));
                runStart = -1;
                urduCount = 0;
            }
        }

        if (runStart >= 0 && urduCount >= MinRun)
            runs.Add((runStart, data.Length));

        // Decode each qualifying run
        foreach (var (from, to) in runs)
        {
            var current = new StringBuilder();
            int paraStart = from;

            for (int i = from; i < to - 1; i += 2)
            {
                ushort cp = (ushort)(data[i] | (data[i + 1] << 8));

                if (cp == 0x000D)
                {
                    var trimmed = current.ToString().Trim();
                    if (trimmed.Length > 0)
                    {
                        paragraphs.Add(trimmed);
                        meta.Add(new ParagraphMeta(trimmed, paraStart, i, false));
                    }
                    current.Clear();
                    paraStart = i + 2;
                    continue;
                }

                // Skip embedded control records
                bool isCtrl = (cp >= 0x0001 && cp <= 0x001F && cp != 0x0009 && cp != 0x000A) || cp == 0x007E;
                if (isCtrl && i + 3 < to)
                {
                    int recLen = data[i + 2] | (data[i + 3] << 8);
                    i += 2 + recLen;
                    continue;
                }

                if (cp >= 0x0020 || cp == 0x0009 || cp == 0x000A)
                    current.Append((char)cp);
            }

            var tail = current.ToString().Trim();
            if (tail.Length > 0)
            {
                paragraphs.Add(tail);
                meta.Add(new ParagraphMeta(tail, paraStart, to, false));
            }
        }

        Console.Error.WriteLine($"[DecodeV3Fallback] Recovered {paragraphs.Count} paragraphs via direct UTF-16LE scan.");
        return new DecodeResult(paragraphs, pageBreakIndices, meta);
    }
}
