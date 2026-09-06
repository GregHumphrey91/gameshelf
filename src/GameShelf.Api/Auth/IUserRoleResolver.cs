using System.Security.Claims;
using GameShelf.Api.Models;

namespace GameShelf.Api.Auth;

/// <summary>Maps an authenticated caller to the role the application has granted them, or null if none.</summary>
public interface IUserRoleResolver
{
    Task<UserRole?> ResolveAsync(ClaimsPrincipal principal, CancellationToken ct);
}
