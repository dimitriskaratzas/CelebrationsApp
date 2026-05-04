using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Tests.Helpers;

internal static class TestDbContextFactory
{
    // Creates a fresh InMemory DB context per test for isolation.
    public static AppDbContext Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
