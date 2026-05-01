using System.Text.RegularExpressions;
using Domain.Common;

namespace Domain.ValueObjects;

public partial class Email : ValueObject
{
    public string Value { get; private set; }

    private Email(string value) { Value = value; }
    private Email() { Value = string.Empty; }   // EF Core

    public static Result<Email> Create(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Result.Failure<Email>("Email cannot be empty.");

        email = email.Trim().ToLowerInvariant();

        if (email.Length > 256)
            return Result.Failure<Email>("Email must not exceed 256 characters.");

        if (!EmailRegex().IsMatch(email))
            return Result.Failure<Email>("Email format is invalid.");

        return Result.Success(new Email(email));
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();
}
