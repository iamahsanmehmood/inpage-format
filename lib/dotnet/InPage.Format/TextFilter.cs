using InPage.Format.Models;

namespace InPage.Format;

/// <summary>
/// 3-layer noise filter for decoded InPage paragraphs.
///
/// Separates actual Urdu content from binary metadata garbage that InPage
/// streams mix with text. See specs/07-text-filtering.md for full documentation.
/// </summary>
public static class TextFilter
{
    private static readonly string[] MetadataStrings =
    [
        "Normal", "@dFF", "InPage Nastaliq", "InPage Naskh",
        "Arial Unicode MS", "Faiz Nastaliq", "DocumentInfo",
        "InPage100", "InPage200", "InPage300", "Root Entry",
    ];

    /// <summary>
    /// Apply all filters and return cleaned paragraphs with metadata.
    /// </summary>
    public static (IReadOnlyList<string> Paragraphs, IReadOnlyList<ParagraphMeta> Meta, int FilteredCount)
        FilterWithMeta(IReadOnlyList<string> raw, IReadOnlyList<ParagraphMeta> meta)
    {
        var outParagraphs = new List<string>();
        var outMeta = new List<ParagraphMeta>();
        var seen = new HashSet<string>();
        int contentRaw = raw.Count(p => p != InPageDecoder.PageBreakMarker);

        for (int i = 0; i < raw.Count; i++)
        {
            var text = raw[i];
            var m = i < meta.Count ? meta[i] : new ParagraphMeta(text, 0, 0, text == InPageDecoder.PageBreakMarker);

            if (text == InPageDecoder.PageBreakMarker)
            {
                outParagraphs.Add(text);
                outMeta.Add(m);
                continue;
            }

            if (!PassesLayer1(text) || !PassesLayer2(text) || !PassesLayer3(text))
                continue;

            // Deduplication (skip short strings)
            if (text.Trim().Length >= 15)
            {
                var fp = text.Replace(" ", "").Replace("\t", "");
                if (!seen.Add(fp)) continue;
            }

            outParagraphs.Add(text);
            outMeta.Add(m);
        }

        // Remove leading/trailing page break markers
        while (outParagraphs.Count > 0 && outParagraphs[0] == InPageDecoder.PageBreakMarker)
        {
            outParagraphs.RemoveAt(0);
            outMeta.RemoveAt(0);
        }
        while (outParagraphs.Count > 0 && outParagraphs[^1] == InPageDecoder.PageBreakMarker)
        {
            outParagraphs.RemoveAt(outParagraphs.Count - 1);
            outMeta.RemoveAt(outMeta.Count - 1);
        }

        int contentKept = outParagraphs.Count(p => p != InPageDecoder.PageBreakMarker);
        int filteredCount = Math.Max(0, contentRaw - contentKept);

        return (outParagraphs, outMeta, filteredCount);
    }

    /// <summary>Apply all filters and return cleaned paragraphs.</summary>
    public static IReadOnlyList<string> Filter(IReadOnlyList<string> raw)
        => FilterWithMeta(raw, []).Paragraphs;

    // ─── Layer 1: Density Filter ──────────────────────────────────────────────

    private static bool PassesLayer1(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.Length == 0) return true;

        // Short numeric/alphanumeric (table cells, dates)
        if (trimmed.Length <= 10 && trimmed.All(c => char.IsDigit(c) || char.IsLetter(c) || c == '-' || c == '.' || c == '/' || c == ' '))
            return true;

        // Short pure Urdu (titles, captions < 15 chars)
        if (trimmed.Length < 15 && trimmed.All(c => CharMaps.IsUrduChar(c) || c == ' ' || c == '،' || c == '۔' || char.IsDigit(c)))
            return true;

        int urdu = CountUrdu(text);
        int total = text.Length;
        if (total == 0) return false;

        // Bilingual bypass: short mixed text with some Urdu
        if (total <= 30 && urdu >= 2 && (double)urdu / total >= 0.15) return true;

        int minUrdu = total < 20 ? 3 : 5;
        if (urdu < minUrdu) return false;

        double minDensity = total < 20 ? 0.30 : 0.40;
        return (double)urdu / total >= minDensity;
    }

    // ─── Layer 2: Pattern + Metadata Filter ──────────────────────────────────

    private static bool PassesLayer2(string text)
    {
        // Only reject metadata when no Urdu is present
        if (CountUrdu(text) == 0)
        {
            foreach (var meta in MetadataStrings)
                if (text.Contains(meta, StringComparison.Ordinal)) return false;
        }

        // Only check repeating patterns for non-Urdu content.
        // Urdu phrases like "اللہ اللہ اللہ" legitimately repeat but are real text.
        if (CountUrdu(text) == 0 && HasRepeatingPattern(text)) return false;
        return true;
    }

    // ─── Layer 3: Repetition + Ligature Filter ────────────────────────────────

    private static bool PassesLayer3(string text)
    {
        int unique = CountUniqueUrdu(text);
        int total = CountUrdu(text);

        // ≤3 unique chars repeating excessively (threshold 20, not 10)
        if (unique <= 3 && total > 20) return false;

        return !IsLigatureHeavy(text);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static int CountUrdu(string text)
    {
        int n = 0;
        foreach (char c in text) if (CharMaps.IsUrduChar(c)) n++;
        return n;
    }

    private static int CountUniqueUrdu(string text)
    {
        var s = new HashSet<char>();
        foreach (char c in text) if (CharMaps.IsUrduChar(c)) s.Add(c);
        return s.Count;
    }

    private static bool IsLigatureHeavy(string text)
    {
        int lig = 0;
        foreach (char c in text)
            if (c >= 0xFB50 && c <= 0xFDFF) lig++;
        return text.Length > 0 && (double)lig / text.Length > 0.5;
    }

    private static bool HasRepeatingPattern(string text)
    {
        var cleaned = new string(text.Where(c => !char.IsWhiteSpace(c)).ToArray());
        if (cleaned.Length < 4) return false;

        var chars = new HashSet<char>(cleaned);
        if (chars.Count <= 2 && cleaned.Length > 10) return true;

        for (int len = 1; len <= 4; len++)
        {
            string pattern = cleaned[..len];
            int hits = 0;
            for (int i = 0; i < cleaned.Length - len + 1; i += len)
                if (cleaned.AsSpan(i, Math.Min(len, cleaned.Length - i)).SequenceEqual(pattern.AsSpan())) hits++;
            if (hits > (double)cleaned.Length / len * 0.8) return true;
        }

        return false;
    }
}
