namespace Application.DTOs;

public record FavoriteDto(
    Guid Id,
    string DisplayName,
    string? NameDayKey,
    DateOnly? BirthdayDate,
    string? Relationship,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateFavoriteRequest(
    Guid Id,
    string DisplayName,
    string? NameDayKey,
    DateOnly? BirthdayDate,
    string? Relationship);

public record UpdateFavoriteRequest(
    string DisplayName,
    string? NameDayKey,
    DateOnly? BirthdayDate,
    string? Relationship);

public record FavoritesSyncResponse(
    IReadOnlyList<FavoriteDto> Favorites,
    IReadOnlyList<Guid> Deletions,
    DateTime SyncedAt,
    bool HasMore);
