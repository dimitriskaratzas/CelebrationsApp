using System.Text.RegularExpressions;
using Domain.Common;

namespace Domain.Entities;

public partial class Favorite : BaseEntity
{
    // Stored lowercase per the API contract. The set is case-insensitive on validation so a
    // client sending "Parent" by mistake is accepted (and normalized) rather than 400-ing.
    private static readonly HashSet<string> AllowedRelationships = new(StringComparer.OrdinalIgnoreCase)
    {
        "parent", "child", "sibling", "spouse",
        "grandparent", "friend", "colleague", "other",
    };

    [GeneratedRegex(@"^[a-z0-9-]{1,64}$")]
    private static partial Regex NameDayKeyRegex();

    public Guid UserId { get; private set; }
    public string DisplayName { get; private set; } = null!;
    public string? NameDayKey { get; private set; }
    public DateOnly? BirthdayDate { get; private set; }
    public string? Relationship { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    private Favorite() { }

    private Favorite(Guid id, Guid userId, string displayName, string? nameDayKey,
                     DateOnly? birthdayDate, string? relationship) : base(id)
    {
        UserId = userId;
        DisplayName = displayName;
        NameDayKey = nameDayKey;
        BirthdayDate = birthdayDate;
        Relationship = relationship;
    }

    public static Result<Favorite> Create(
        Guid id, Guid userId, string displayName, string? nameDayKey,
        DateOnly? birthdayDate, string? relationship)
    {
        var validation = Validate(displayName, nameDayKey, relationship);
        if (validation.IsFailure)
            return Result.Failure<Favorite>(validation.Error);

        return Result.Success(new Favorite(
            id,
            userId,
            displayName.Trim(),
            nameDayKey,
            birthdayDate,
            relationship?.ToLowerInvariant()));
    }

    public Result Update(string displayName, string? nameDayKey,
                         DateOnly? birthdayDate, string? relationship)
    {
        var validation = Validate(displayName, nameDayKey, relationship);
        if (validation.IsFailure)
            return validation;

        DisplayName = displayName.Trim();
        NameDayKey = nameDayKey;
        BirthdayDate = birthdayDate;
        Relationship = relationship?.ToLowerInvariant();
        SetUpdated();
        return Result.Success();
    }

    public void SoftDelete()
    {
        DeletedAt = DateTime.UtcNow;
        SetUpdated();
    }

    private static Result Validate(string displayName, string? nameDayKey, string? relationship)
    {
        if (string.IsNullOrWhiteSpace(displayName))
            return Result.Failure("Το όνομα είναι υποχρεωτικό.");
        if (displayName.Trim().Length > 100)
            return Result.Failure("Το όνομα δεν μπορεί να ξεπερνά τους 100 χαρακτήρες.");

        if (nameDayKey is not null && !NameDayKeyRegex().IsMatch(nameDayKey))
            return Result.Failure("Μη έγκυρο αναγνωριστικό ονομαστικής.");

        if (relationship is not null && !AllowedRelationships.Contains(relationship))
            return Result.Failure("Μη έγκυρη σχέση.");

        return Result.Success();
    }
}
