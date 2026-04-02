namespace InPage.Format.Models;

/// <summary>
/// Result of decoding an InPage content stream (before noise filtering).
/// </summary>
public sealed record DecodeResult(
    IReadOnlyList<string> Paragraphs,
    IReadOnlyList<int> PageBreakIndices,
    IReadOnlyList<ParagraphMeta> ParagraphMeta
);

/// <summary>
/// Result of the full parse + filter pipeline. Ready for display.
/// </summary>
public sealed record InPageResult(
    /// <summary>InPage version (1, 2, or 3).</summary>
    int Version,
    /// <summary>Filtered, deduplicated paragraphs ready for display.</summary>
    IReadOnlyList<string> Paragraphs,
    /// <summary>Per-paragraph metadata aligned with Paragraphs.</summary>
    IReadOnlyList<ParagraphMeta> ParagraphMeta,
    /// <summary>Number of paragraphs dropped by the noise filter.</summary>
    int FilteredCount
);
