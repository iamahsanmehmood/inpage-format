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
            Console.Error.WriteLine("[DecodeV3] Boundary marker not found. Returning empty document.");
            return new DecodeResult(paragraphs, pageBreakIndices, meta);
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
}
