using Xunit;
using InPage.Format;

namespace InPage.Format.Tests;

public class DecoderV1V2Tests
{
    private static byte[] B(params byte[] bytes) => bytes;

    [Fact]
    public void DecodesAlef()
    {
        var data = B(0x04, 0x81, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0627", result.Paragraphs[0]);
    }

    [Fact]
    public void DecodesShortUrduWord()
    {
        // 04 81 = ا, 04 82 = ب, 04 A4 = ی + CR
        var data = B(0x04, 0x81, 0x04, 0x82, 0x04, 0xA4, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0627\u0628\u06CC", result.Paragraphs[0]);
    }

    [Fact]
    public void DecodesCompositeAlefHamza()
    {
        // 04 81 04 BF = أ (not ا + ٔ separately)
        var data = B(0x04, 0x81, 0x04, 0xBF, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0623", result.Paragraphs[0]);
    }

    [Fact]
    public void DecodesCompositeAlefMadda()
    {
        var data = B(0x04, 0x81, 0x04, 0xB3, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0622", result.Paragraphs[0]);
    }

    [Fact]
    public void CompositeMatchedBeforeSingleByte()
    {
        // Must get U+0623 (composite), not U+0627 + U+0654 (two singles)
        var data = B(0x04, 0x81, 0x04, 0xBF, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0623", result.Paragraphs[0]);
        Assert.NotEqual("\u0627\u0654", result.Paragraphs[0]);
    }

    [Fact]
    public void SplitsOnCR()
    {
        var data = B(0x04, 0x81, 0x0D, 0x04, 0x82, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal(2, result.Paragraphs.Count);
    }

    [Fact]
    public void SplitsOnCRLFAsSingleBreak()
    {
        var data = B(0x04, 0x81, 0x0D, 0x0A, 0x04, 0x82, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal(2, result.Paragraphs.Count);
    }

    [Fact]
    public void DiscardsEmptyParagraphs()
    {
        var data = B(0x0D, 0x0D, 0x04, 0x81, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Single(result.Paragraphs);
    }

    [Fact]
    public void EmitsPageBreakMarkerOnFormFeed()
    {
        var data = B(0x04, 0x81, 0x0D, 0x0C, 0x04, 0x82, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Contains(InPageDecoder.PageBreakMarker, result.Paragraphs);
        Assert.Single(result.PageBreakIndices);
    }

    [Fact]
    public void PageBreakPreservesContentAroundIt()
    {
        var data = B(0x04, 0x81, 0x0D, 0x0C, 0x04, 0x82, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0627", result.Paragraphs[0]);
        Assert.Equal(InPageDecoder.PageBreakMarker, result.Paragraphs[1]);
        Assert.Equal("\u0628", result.Paragraphs[2]);
    }

    [Fact]
    public void InsertsSpaceBetweenWordsOnControlByte()
    {
        // ا (word1) + unknown 0xFF + ب (word2)
        var data = B(0x04, 0x81, 0xFF, 0x04, 0x82, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0627 \u0628", result.Paragraphs[0]);
    }

    [Fact]
    public void NoLeadingSpaceBeforeFirstChar()
    {
        var data = B(0xFF, 0x04, 0x81, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal("\u0627", result.Paragraphs[0]);
    }

    [Fact]
    public void DoesNotCrashOnEmptyInput()
    {
        var result = InPageDecoder.DecodeV1V2(Array.Empty<byte>());
        Assert.Empty(result.Paragraphs);
    }

    [Fact]
    public void MetaAlignedWithParagraphs()
    {
        var data = B(0x04, 0x81, 0x0D, 0x04, 0x82, 0x0D);
        var result = InPageDecoder.DecodeV1V2(data);
        Assert.Equal(result.Paragraphs.Count, result.ParagraphMeta.Count);
    }
}

public class DecoderV3Tests
{
    /// <summary>Build a minimal valid V3 stream with one text span.</summary>
    private static byte[] BuildV3Stream(string text, int styleId = 1)
    {
        // Encode text as UTF-16LE + CR terminator
        var textBytes = new List<byte>();
        foreach (char ch in text)
        {
            textBytes.Add((byte)(ch & 0xFF));
            textBytes.Add((byte)((ch >> 8) & 0xFF));
        }
        textBytes.AddRange([0x0D, 0x00]); // CR

        int byteLen = textBytes.Count;
        byte[] structBytes =
        [
            (byte)(styleId & 0xFF), (byte)((styleId >> 8) & 0xFF), 0, 0,
            (byte)(byteLen & 0xFF), (byte)((byteLen >> 8) & 0xFF), 0, 0,
        ];

        var header = new byte[0x1000]; // pad to ensure boundary is at 0x1000+
        var result = new List<byte>(header);
        result.AddRange(structBytes);
        result.AddRange([0xFF, 0xFF, 0xFF, 0xFF, 0x0D, 0x00]); // boundary marker
        result.AddRange(textBytes);
        return result.ToArray();
    }

    [Fact]
    public void ExtractsSimpleUrduParagraph()
    {
        var stream = BuildV3Stream("\u0627\u0628\u06CC");
        var result = InPageDecoder.DecodeV3(stream);
        Assert.Single(result.Paragraphs);
        Assert.Equal("\u0627\u0628\u06CC", result.Paragraphs[0]);
    }

    [Fact]
    public void ReturnsEmptyWhenBoundaryMarkerNotFound()
    {
        var data = new byte[100];
        var result = InPageDecoder.DecodeV3(data);
        Assert.Empty(result.Paragraphs);
    }

    [Fact]
    public void DoesNotCrashOnEmptyInput()
    {
        var result = InPageDecoder.DecodeV3(Array.Empty<byte>());
        Assert.Empty(result.Paragraphs);
    }

    [Fact]
    public void StyleIdPreservedInMeta()
    {
        var stream = BuildV3Stream("\u0627", styleId: 42);
        var result = InPageDecoder.DecodeV3(stream);
        Assert.Equal(42, result.ParagraphMeta[0].StyleId);
    }

    [Fact]
    public void SkipsControlCodeInjectionRecords()
    {
        // ا + [ctrl 0x01, len 2, data AA BB] + ب + CR
        var rawText = new byte[]
        {
            0x27, 0x06,                         // ا (U+0627)
            0x01, 0x00, 0x02, 0x00, 0xAA, 0xBB, // ctrl record
            0x28, 0x06,                         // ب (U+0628)
            0x0D, 0x00,                         // CR
        };

        byte[] structBytes =
        [
            1, 0, 0, 0,
            (byte)(rawText.Length & 0xFF), (byte)((rawText.Length >> 8) & 0xFF), 0, 0,
        ];

        var result2 = new List<byte>(new byte[0x1000]);
        result2.AddRange(structBytes);
        result2.AddRange([0xFF, 0xFF, 0xFF, 0xFF, 0x0D, 0x00]);
        result2.AddRange(rawText);

        var decoded = InPageDecoder.DecodeV3(result2.ToArray());
        Assert.Equal("\u0627\u0628", decoded.Paragraphs[0]);
    }
}
