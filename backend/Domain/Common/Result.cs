namespace Domain.Common;

public class Result
{
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public string Error { get; }

    // Optional machine-readable error code (e.g. "EMAIL_TAKEN", "FREE_TIER_CAP").
    // Empty when the failure is purely validation / not status-meaningful.
    public string ErrorCode { get; }

    protected Result(bool isSuccess, string error, string errorCode)
    {
        IsSuccess = isSuccess;
        Error = error;
        ErrorCode = errorCode;
    }

    public static Result Success() => new(true, string.Empty, string.Empty);
    public static Result Failure(string error) => new(false, error, string.Empty);
    public static Result Failure(string code, string error) => new(false, error, code);

    public static Result<T> Success<T>(T value) => new(value, true, string.Empty, string.Empty);
    public static Result<T> Failure<T>(string error) => new(default, false, error, string.Empty);
    public static Result<T> Failure<T>(string code, string error) => new(default, false, error, code);
}

public class Result<T> : Result
{
    public T? Value { get; }

    internal Result(T? value, bool isSuccess, string error, string errorCode)
        : base(isSuccess, error, errorCode)
    {
        Value = value;
    }
}
