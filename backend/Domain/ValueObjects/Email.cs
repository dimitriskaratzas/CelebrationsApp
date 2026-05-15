using System.Net.Mail;
using Domain.Common;

namespace Domain.ValueObjects;

public class Email : ValueObject
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

        // MailAddress applies RFC 5321-ish parsing — stricter than the previous loose regex and
        // rejects shapes like trailing dots while still accepting all real-world addresses.
        if (!MailAddress.TryCreate(email, out var parsed) || !string.Equals(parsed.Address, email, StringComparison.Ordinal))
            return Result.Failure<Email>("Email format is invalid.");

        // Require a dot in the host part — MailAddress accepts bare hosts like "user@tld"
        // which have no chance of resolving in production.
        var atIndex = email.IndexOf('@');
        if (atIndex < 0 || email.IndexOf('.', atIndex) < 0)
            return Result.Failure<Email>("Email format is invalid.");

        return Result.Success(new Email(email));
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }
}
