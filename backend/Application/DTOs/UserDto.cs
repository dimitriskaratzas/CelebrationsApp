namespace Application.DTOs;

public record UserDto(
    Guid Id,
    string? Email,
    bool IsAnonymous,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt);
