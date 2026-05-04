using Application.DTOs;
using Domain.Entities;

namespace Application.Mapping;

public static class UserMapping
{
    public static UserDto ToDto(User user)
    {
        return new UserDto(
            user.Id,
            user.Email?.Value,
            user.IsAnonymous,
            user.Status.ToString(),
            user.CreatedAt,
            user.UpdatedAt);
    }
}
