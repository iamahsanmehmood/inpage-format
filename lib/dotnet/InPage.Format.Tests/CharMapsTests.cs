using Xunit;
using InPage.Format;

namespace InPage.Format.Tests;

public class CharMapsTests
{
    [Fact]
    public void Urdu_MapsAlef() =>
        Assert.Equal("\u0627", CharMaps.Urdu[0x81]);

    [Fact]
    public void Urdu_MapsAllCoreConsonants()
    {
        byte[] letters = [
            0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A,
            0x8B, 0x8C, 0x8D, 0x8E, 0x8F, 0x90, 0x91, 0x92, 0x93, 0x94,
            0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E,
            0x9F, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7,
        ];
        foreach (var b in letters)
            Assert.True(CharMaps.Urdu.ContainsKey(b), $"Missing byte 0x{b:X2}");
    }

    [Fact]
    public void Urdu_MapsDiacritics()
    {
        Assert.Equal("\u0650", CharMaps.Urdu[0xAA]); // Zer
        Assert.Equal("\u0651", CharMaps.Urdu[0xAD]); // Shadda
        Assert.Equal("\u0654", CharMaps.Urdu[0xBF]); // Hamza Above
    }

    [Fact]
    public void Urdu_MapsAlternateDiacritics()
    {
        Assert.Equal("\u0657", CharMaps.Urdu[0xC1]); // Inverted Damma (alt)
        Assert.Equal("\u0655", CharMaps.Urdu[0xC3]); // Hamza Below (unique)
        Assert.Equal("\u0651", CharMaps.Urdu[0xC6]); // Shadda (alt)
    }

    [Fact]
    public void Urdu_MapsUrduNumerals()
    {
        Assert.Equal("\u06F0", CharMaps.Urdu[0xD0]);
        Assert.Equal("\u06F5", CharMaps.Urdu[0xD5]);
        Assert.Equal("\u06F9", CharMaps.Urdu[0xD9]);
    }

    [Fact]
    public void Urdu_MapsUrduFullStop() =>
        Assert.Equal("\u06D4", CharMaps.Urdu[0xF3]);

    [Fact]
    public void ArabicOverrides_OverridesKaf() =>
        Assert.Equal("\u0643", CharMaps.ArabicOverrides[0x9C]); // ك Arabic Kaf

    [Fact]
    public void ArabicOverrides_MapsArabicIndicDigits()
    {
        Assert.Equal("\u0660", CharMaps.ArabicOverrides[0x7C]); // ٠ 0
        Assert.Equal("\u0665", CharMaps.ArabicOverrides[0x81]); // ٥ 5
        Assert.Equal("\u0669", CharMaps.ArabicOverrides[0x85]); // ٩ 9
    }

    [Fact]
    public void CompositeSequences_AlefHamzaAbove() =>
        Assert.Equal("\u0623", CharMaps.CompositeSequences[(0x81, 0xBF)]);

    [Fact]
    public void CompositeSequences_AlefMadda() =>
        Assert.Equal("\u0622", CharMaps.CompositeSequences[(0x81, 0xB3)]);

    [Fact]
    public void CompositeSequences_HasExactlyFourEntries() =>
        Assert.Equal(4, CharMaps.CompositeSequences.Count);

    [Theory]
    [InlineData(0x0627, true)]  // ا
    [InlineData(0x06CC, true)]  // ی
    [InlineData(0xFDFA, true)]  // ﷺ
    [InlineData(0x0041, false)] // A (Latin)
    [InlineData(0x0031, false)] // 1 (ASCII digit)
    public void IsUrduCodePoint_WorksCorrectly(int cp, bool expected) =>
        Assert.Equal(expected, CharMaps.IsUrduCodePoint(cp));
}
