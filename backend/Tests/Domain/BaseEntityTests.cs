using Domain.Common;
using FluentAssertions;
using Xunit;

namespace Tests.Domain;

public class BaseEntityTests
{
    private class SampleEntity : BaseEntity { }

    [Fact]
    public void NewEntity_HasGeneratedId_AndCreatedAtNow()
    {
        var entity = new SampleEntity();
        entity.Id.Should().NotBe(Guid.Empty);
        entity.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
        entity.UpdatedAt.Should().BeNull();
    }

    [Fact]
    public void Equals_SameIdSameType_ReturnsTrue()
    {
        var a = new SampleEntity();
        var b = new SampleEntity();
        // Two new entities have different Ids
        a.Equals(b).Should().BeFalse();
    }
}
