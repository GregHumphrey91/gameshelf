using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace GameShelf.Api.Auth;

/// <summary>
/// Runs after authentication succeeds and attaches the application role (from the Users table) as a claim,
/// so authorization policies can stay declarative. A principal with no resolvable role keeps no role claim
/// and fails every policy.
/// </summary>
public sealed class RoleClaimsTransformation(IUserRoleResolver resolver) : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        // May be invoked more than once per request; only resolve once.
        if (principal.Identity?.IsAuthenticated != true || principal.HasClaim(c => c.Type == GameShelfClaims.Role))
        {
            return principal;
        }

        var role = await resolver.ResolveAsync(principal, CancellationToken.None);
        if (role is null)
        {
            return principal;
        }

        principal.AddIdentity(new ClaimsIdentity([new Claim(GameShelfClaims.Role, role.Value.ToString())]));
        return principal;
    }
}
