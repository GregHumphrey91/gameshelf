using System.Security.Claims;
using GameShelf.Api.Data;
using GameShelf.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameShelf.Api.Auth;

/// <summary>
/// The caller's role comes from the Users table, looked up by the token's <c>sub</c> claim.
/// A subject that is not in the table gets no role (and therefore 403 on every endpoint) unless it is
/// listed in <see cref="AuthOptions.BootstrapCurators"/>, in which case a Curator row is created on first sight.
/// </summary>
public sealed class DatabaseUserRoleResolver(
    IUserRepository users,
    IOptions<AuthOptions> options,
    TimeProvider clock,
    ILogger<DatabaseUserRoleResolver> logger) : IUserRoleResolver
{
    public async Task<UserRole?> ResolveAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        var subject = principal.FindFirstValue(GameShelfClaims.Subject);
        if (string.IsNullOrWhiteSpace(subject))
        {
            return null;
        }

        var existing = await users.FindBySubjectAsync(subject, ct);
        if (existing is not null)
        {
            return existing.Role;
        }

        var email = principal.FindFirstValue(GameShelfClaims.Email);
        if (!IsBootstrapCurator(subject, email))
        {
            logger.LogInformation("Authenticated subject {Subject} has no row in Users; access denied", subject);
            return null;
        }

        try
        {
            var created = await users.AddAsync(new User
            {
                OktaSubject = subject,
                Email = email ?? subject,
                Role = UserRole.Curator,
                CreatedAt = clock.GetUtcNow().UtcDateTime,
            }, ct);

            logger.LogInformation("Bootstrapped {Subject} as Curator", subject);
            return created.Role;
        }
        catch (DbUpdateException)
        {
            // Two first requests raced; the unique index let exactly one insert through. Use that row.
            var winner = await users.FindBySubjectAsync(subject, ct);
            return winner?.Role;
        }
    }

    private bool IsBootstrapCurator(string subject, string? email) =>
        options.Value.BootstrapCurators.Any(entry =>
            entry.Equals(subject, StringComparison.OrdinalIgnoreCase)
            || (email is not null && entry.Equals(email, StringComparison.OrdinalIgnoreCase)));
}
