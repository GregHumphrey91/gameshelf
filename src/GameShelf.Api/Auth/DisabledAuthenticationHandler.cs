using System.Security.Claims;
using System.Text.Encodings.Web;
using GameShelf.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace GameShelf.Api.Auth;

/// <summary>
/// Authentication scheme used when <c>Auth:Enabled=false</c>: every request is a fixed local Curator.
/// Lets the SPA, Playwright and the integration tests run without an identity provider.
/// Startup refuses to register this handler in the Production environment.
/// </summary>
public sealed class DisabledAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Disabled";
    public const string Subject = "local-dev";
    public const string Email = "local-dev@gameshelf.local";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(GameShelfClaims.Subject, Subject),
                new Claim(GameShelfClaims.Email, Email),
                new Claim(GameShelfClaims.Role, nameof(UserRole.Curator)),
            ],
            SchemeName,
            nameType: GameShelfClaims.Subject,
            roleType: GameShelfClaims.Role);

        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
