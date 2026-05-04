using Domain.Common;
using FluentAssertions;
using Xunit;

namespace Tests.Domain;

public class ResultTests
{
    [Fact]
    public void Success_ReturnsIsSuccessTrue()
    {
        var result = Result.Success();
        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
        result.Error.Should().BeEmpty();
    }

    [Fact]
    public void Failure_ReturnsIsSuccessFalse_WithError()
    {
        var result = Result.Failure("oops");
        result.IsSuccess.Should().BeFalse();
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be("oops");
    }

    [Fact]
    public void GenericSuccess_StoresValue()
    {
        var result = Result.Success<int>(42);
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(42);
    }

    [Fact]
    public void GenericFailure_StoresError_AndDefaultValue()
    {
        var result = Result.Failure<int>("bad");
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be("bad");
        result.Value.Should().Be(0);
    }
}
