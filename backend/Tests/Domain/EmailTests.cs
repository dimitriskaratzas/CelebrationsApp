using Domain.ValueObjects;
using FluentAssertions;
using Xunit;

namespace Tests.Domain;

public class EmailTests
{
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("first.last@sub.example.gr")]
    [InlineData("USER@EXAMPLE.COM")]
    public void Create_ValidEmail_Succeeds(string raw)
    {
        var result = Email.Create(raw);
        result.IsSuccess.Should().BeTrue();
        result.Value!.Value.Should().Be(raw.Trim().ToLowerInvariant());
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("not-an-email")]
    [InlineData("missing@tld")]
    [InlineData("@nope.com")]
    public void Create_InvalidEmail_Fails(string raw)
    {
        var result = Email.Create(raw);
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Create_TooLongEmail_Fails()
    {
        var local = new string('a', 250);
        var result = Email.Create($"{local}@example.com");
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void TwoEmails_SameNormalizedValue_AreEqual()
    {
        var a = Email.Create("user@example.com").Value!;
        var b = Email.Create("USER@EXAMPLE.COM").Value!;
        a.Should().Be(b);
    }
}
