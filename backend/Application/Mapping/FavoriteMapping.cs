using Application.DTOs;
using Domain.Entities;

namespace Application.Mapping;

public static class FavoriteMapping
{
    public static FavoriteDto ToDto(this Favorite favorite) => new(
        favorite.Id,
        favorite.DisplayName,
        favorite.NameDayKey,
        favorite.BirthdayDate,
        favorite.Relationship,
        favorite.CreatedAt,
        favorite.UpdatedAt);
}
