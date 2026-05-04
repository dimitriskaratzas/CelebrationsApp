using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);

        builder.OwnsOne(u => u.Email, email =>
        {
            email.Property(e => e.Value)
                .HasColumnName("Email")
                .HasMaxLength(256);

            // Email column is NOT unique here because anonymous users have NULL.
            // Uniqueness for non-null emails is enforced by a partial unique index
            // declared in create_tables.sql:
            //   CREATE UNIQUE INDEX ... ON "Users" ("Email") WHERE "Email" IS NOT NULL;
        });

        builder.Property(u => u.PasswordHash)
            .HasColumnName("PasswordHash");

        builder.Property(u => u.IsAnonymous)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(u => u.Status)
            .HasConversion<string>()
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(u => u.CreatedAt).IsRequired();
    }
}
