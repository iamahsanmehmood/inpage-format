using Xunit;
using InPage.Format;

namespace InPage.Format.Tests;

public class TextFilterTests
{
    private const string UrduSentence = "یہ ایک اردو جملہ ہے جو کافی لمبا ہے";
    private const string ShortTitle = "اپنا گھر";
    private const string ReligiousPhrase = "اللہ اللہ اللہ";
    private const string PureNumber = "12345";
    private const string MetadataString = "InPage Nastaliq";
    private const string MetadataWithUrdu = "InPage Nastaliq کا متن";
    private const string LigatureGarbage = "\uFB50\uFB51\uFB52\uFB53\uFB54\uFB55\uFB56";
    private static readonly string PageBreak = InPageDecoder.PageBreakMarker;

    [Fact]
    public void PassesNormalUrduSentence()
    {
        var result = TextFilter.Filter([UrduSentence]);
        Assert.Contains(UrduSentence, result);
    }

    [Fact]
    public void PassesShortPureUrduTitle()
    {
        var result = TextFilter.Filter([ShortTitle]);
        Assert.Contains(ShortTitle, result);
    }

    [Fact]
    public void PassesShortNumericTableCell()
    {
        var result = TextFilter.Filter([PureNumber]);
        Assert.Contains(PureNumber, result);
    }

    [Fact]
    public void PassesBilingualTextWithSomeUrdu()
    {
        var bilingual = "By: عمر";
        var result = TextFilter.Filter([bilingual]);
        Assert.Contains(bilingual, result);
    }

    [Fact]
    public void RejectsMetadataStringWithNoUrdu()
    {
        var result = TextFilter.Filter([MetadataString]);
        Assert.DoesNotContain(MetadataString, result);
    }

    [Fact]
    public void PassesMetadataLikeStringWithUrdu()
    {
        var result = TextFilter.Filter([MetadataWithUrdu]);
        Assert.Contains(MetadataWithUrdu, result);
    }

    [Fact]
    public void RejectsKnownStreamNames()
    {
        Assert.Empty(TextFilter.Filter(["InPage100"]));
        Assert.Empty(TextFilter.Filter(["InPage300"]));
        Assert.Empty(TextFilter.Filter(["Root Entry"]));
    }

    [Fact]
    public void RejectsRepeatingAsciiGarbage()
    {
        var garbage = "AAAAAAAAAAAAA";
        var result = TextFilter.Filter([garbage]);
        Assert.DoesNotContain(garbage, result);
    }

    [Fact]
    public void PassesReligiousPhraseUnderThreshold()
    {
        // "اللہ اللہ اللہ" — 3 unique Urdu chars, ~9 total (≤ 20 threshold)
        var result = TextFilter.Filter([ReligiousPhrase]);
        Assert.Contains(ReligiousPhrase, result);
    }

    [Fact]
    public void RejectsLowUniquenessUrduExceedingThreshold()
    {
        // Repeat اللہ many times to exceed threshold of 20 total Urdu chars
        var longRepeat = string.Concat(Enumerable.Repeat("اللہ ", 10)).Trim();
        var result = TextFilter.Filter([longRepeat]);
        Assert.DoesNotContain(longRepeat, result);
    }

    [Fact]
    public void RejectsLigatureHeavyText()
    {
        var result = TextFilter.Filter([LigatureGarbage]);
        Assert.DoesNotContain(LigatureGarbage, result);
    }

    [Fact]
    public void DeduplicatesLongParagraphs()
    {
        var result = TextFilter.Filter([UrduSentence, UrduSentence]);
        Assert.Single(result.Where(p => p == UrduSentence));
    }

    [Fact]
    public void PageBreakPreservedWhenSurroundedByContent()
    {
        // A lone marker gets stripped as leading/trailing — that's correct.
        // When surrounded by content it must be preserved.
        const string second = "کوئی اور جملہ جو مختلف ہے اور اچھا ہے";
        var result = TextFilter.Filter([UrduSentence, PageBreak, second]);
        Assert.Contains(PageBreak, result);
    }

    [Fact]
    public void StripsLeadingPageBreak()
    {
        var result = TextFilter.Filter([PageBreak, UrduSentence]);
        Assert.Equal(UrduSentence, result[0]);
    }

    [Fact]
    public void StripsTrailingPageBreak()
    {
        var result = TextFilter.Filter([UrduSentence, PageBreak]);
        Assert.Equal(UrduSentence, result[^1]);
    }

    [Fact]
    public void PreservesMidDocumentPageBreak()
    {
        // Use two different sentences so deduplication does not remove one,
        // which would leave PAGE_BREAK_MARKER as trailing and strip it.
        const string second = "کوئی اور مختلف جملہ جو پہلے جملے سے الگ ہے";
        var result = TextFilter.Filter([UrduSentence, PageBreak, second]);
        Assert.Contains(PageBreak, result);
    }

    [Fact]
    public void FilteredCountEqualsDroppedParagraphs()
    {
        var raw = new[] { UrduSentence, MetadataString, "InPage100" };
        var (_, _, filteredCount) = TextFilter.FilterWithMeta(raw, []);
        Assert.Equal(2, filteredCount);
    }

    [Fact]
    public void FilteredCountIsZeroWhenNothingDropped()
    {
        var (_, _, filteredCount) = TextFilter.FilterWithMeta([UrduSentence], []);
        Assert.Equal(0, filteredCount);
    }

    [Fact]
    public void ParagraphsAndMetaAligned()
    {
        var raw = new[] { UrduSentence, MetadataString };
        var (paragraphs, meta, _) = TextFilter.FilterWithMeta(raw, []);
        Assert.Equal(paragraphs.Count, meta.Count);
    }
}
