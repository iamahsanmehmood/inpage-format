namespace InPage.Format.Models;

/// <summary>
/// Metadata for a single decoded paragraph.
/// </summary>
public sealed record ParagraphMeta(
    /// <summary>Decoded text of this paragraph.</summary>
    string Text,
    /// <summary>Byte offset in the content stream where this paragraph begins.</summary>
    int StartOffset,
    /// <summary>Byte offset in the content stream where this paragraph ends.</summary>
    int EndOffset,
    /// <summary>True if this entry is a page break marker, not actual text.</summary>
    bool IsPageBreak,
    /// <summary>V3 only: style ID from the struct array for this paragraph's first span.</summary>
    int? StyleId = null
);
