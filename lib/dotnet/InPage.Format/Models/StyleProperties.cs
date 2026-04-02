namespace InPage.Format.Models;

/// <summary>Text alignment values.</summary>
public enum Alignment { Right, Center, Left, Justify }

/// <summary>
/// Formatting properties for a paragraph or character run.
/// </summary>
public sealed record StyleProperties(
    int FontSize = 18,
    int FontIndex = 0,
    bool Bold = false,
    bool Italic = false,
    bool Underline = false,
    int ColorIndex = 0,
    Alignment Alignment = Alignment.Right,
    double LineSpacing = 2.4,
    double? IndentFirstLine = null,
    double? IndentLeft = null,
    double? IndentRight = null
);
