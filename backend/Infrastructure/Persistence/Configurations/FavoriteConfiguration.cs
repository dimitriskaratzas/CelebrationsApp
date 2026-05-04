using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class FavoriteConfiguration : IEntityTypeConfiguration<Favorite>
{
    public void Configure(EntityTypeBuilder<Favorite> builder)
    {
        builder.ToTable("Favorites");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.UserId).IsRequired();

        builder.Property(f => f.DisplayName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(f => f.NameDayKey)
            .HasMaxLength(64);

        builder.Property(f => f.BirthdayDate)
            .HasColumnType("date");

        builder.Property(f => f.Relationship)
            .HasMaxLength(32);

        builder.Property(f => f.CreatedAt).IsRequired();

        // Indexes mirror those declared in database/create_tables.sql:
        //   - (UserId, UpdatedAt) — supports ?since= queries
        //   - (UserId) WHERE DeletedAt IS NULL — partial index for cap count
        // EF Core can't express partial indexes, so the partial index is SQL-only.
        builder.HasIndex(f => new { f.UserId, f.UpdatedAt })
            .HasDatabaseName("IX_Favorites_UserId_UpdatedAt");
    }
}
