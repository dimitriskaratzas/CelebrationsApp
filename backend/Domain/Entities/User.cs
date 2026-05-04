using Domain.Common;
using Domain.Enums;
using Domain.ValueObjects;

namespace Domain.Entities;

public class User : BaseEntity
{
    public Email? Email { get; private set; }
    public string? PasswordHash { get; private set; }
    public bool IsAnonymous { get; private set; }
    public UserStatus Status { get; private set; }

    private User() { }

    private User(Email? email, bool isAnonymous)
    {
        Email = email;
        IsAnonymous = isAnonymous;
        Status = UserStatus.Active;
    }

    public static User CreateAnonymous()
    {
        return new User(email: null, isAnonymous: true);
    }

    public static Result<User> CreateRegistered(string email)
    {
        var emailResult = Email.Create(email);
        if (emailResult.IsFailure)
            return Result.Failure<User>(emailResult.Error);

        return Result.Success(new User(emailResult.Value!, isAnonymous: false));
    }

    // Promotes an anonymous user to a registered user during the "claim" flow:
    // user opens app anonymously, later registers with email + password.
    public Result Claim(string email, string passwordHash)
    {
        if (!IsAnonymous)
            return Result.Failure("User is already registered.");

        var emailResult = Email.Create(email);
        if (emailResult.IsFailure)
            return Result.Failure(emailResult.Error);

        if (string.IsNullOrWhiteSpace(passwordHash))
            return Result.Failure("Password hash is required.");

        Email = emailResult.Value!;
        PasswordHash = passwordHash;
        IsAnonymous = false;
        SetUpdated();
        return Result.Success();
    }

    public void SetPasswordHash(string hash)
    {
        if (string.IsNullOrWhiteSpace(hash))
            throw new ArgumentException("Password hash cannot be empty.", nameof(hash));

        PasswordHash = hash;
        SetUpdated();
    }

    public Result UpdateEmail(string newEmail)
    {
        var emailResult = Email.Create(newEmail);
        if (emailResult.IsFailure)
            return Result.Failure(emailResult.Error);

        Email = emailResult.Value!;
        SetUpdated();
        return Result.Success();
    }

    public Result Deactivate()
    {
        if (Status == UserStatus.Inactive)
            return Result.Failure("User is already inactive.");

        Status = UserStatus.Inactive;
        SetUpdated();
        return Result.Success();
    }
}
