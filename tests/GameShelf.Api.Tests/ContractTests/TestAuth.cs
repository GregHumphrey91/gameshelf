using System.Security.Claims;
using System.Text.Encodings.Web;
using GameShelf.Api.Auth;
using GameShelf.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GameShelf.Api.Tests.ContractTests;

/// <summary>Subjects the contract factory knows about, and the role each one has.</summary>
public static class TestUsers
{
    public const string Curator = "curator@contract.test";
    public const string Reader = "reader@contract.test";

    /// <summary>Authenticates fine but has no row in the Users table.</summary>
    public const string Stranger = "stranger@contract.test";
}

/// <summary>
/// Stands in for the JWT bearer scheme in contract tests: the caller is whoever the
/// <c>X-Test-Subject</c> header says. No header → no identity → 401 challenge, exactly like a missing token.
/// </summary>
public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";
    public const string SubjectHeader = "X-Test-Subject";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(SubjectHeader, out var subject) || string.IsNullOrWhiteSpace(subject))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var identity = new ClaimsIdentity(
            [new Claim(GameShelfClaims.Subject, subject!), new Claim(GameShelfClaims.Email, subject!)],
            SchemeName,
            nameType: GameShelfClaims.Subject,
            roleType: GameShelfClaims.Role);

        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}

/// <summary>Role lookup without a database: a dictionary keyed by subject.</summary>
public sealed class FakeRoleResolver : IUserRoleResolver
{
    public Dictionary<string, UserRole> Roles { get; } = new(StringComparer.OrdinalIgnoreCase)
    {
        [TestUsers.Curator] = UserRole.Curator,
        [TestUsers.Reader] = UserRole.Reader,
    };

    public Task<UserRole?> ResolveAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        var subject = principal.FindFirstValue(GameShelfClaims.Subject);
        return Task.FromResult(subject is not null && Roles.TryGetValue(subject, out var role) ? role : (UserRole?)null);
    }
}
