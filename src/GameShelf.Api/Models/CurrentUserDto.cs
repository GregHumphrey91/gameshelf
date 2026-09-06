using System.Security.Claims;
using GameShelf.Api.Auth;

namespace GameShelf.Api.Models;

/// <param name="Role">Null when the account is authenticated but has no row in the Users table.</param>
public record CurrentUserDto(string Subject, string? Email, UserRole? Role)
{
    public static CurrentUserDto From(ClaimsPrincipal principal) => new(
        principal.FindFirstValue(GameShelfClaims.Subject) ?? string.Empty,
        principal.FindFirstValue(GameShelfClaims.Email),
        Enum.TryParse<UserRole>(principal.FindFirstValue(GameShelfClaims.Role), out var role) ? role : null);
}
