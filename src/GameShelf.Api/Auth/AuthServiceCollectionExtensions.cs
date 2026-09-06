using GameShelf.Api.Data;
using GameShelf.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace GameShelf.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    /// <summary>
    /// Authentication: JWT bearer tokens from the configured issuer (or the disabled scheme for local work).
    /// Authorization: every endpoint requires an authenticated caller unless marked [AllowAnonymous];
    /// the Reader/Curator policies additionally require the role the Users table grants.
    /// </summary>
    public static IServiceCollection AddGameShelfAuth(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var section = configuration.GetSection(AuthOptions.SectionName);
        services.Configure<AuthOptions>(section);
        var auth = section.Get<AuthOptions>() ?? new AuthOptions();

        if (!auth.Enabled && environment.IsProduction())
        {
            throw new InvalidOperationException("Auth:Enabled=false is not allowed in the Production environment.");
        }

        if (auth.Enabled && string.IsNullOrWhiteSpace(auth.Issuer))
        {
            throw new InvalidOperationException(
                "Auth:Issuer is required when Auth:Enabled is true (e.g. https://<org>.okta.com/oauth2/default). " +
                "Set Auth:Enabled=false to run without an identity provider (local development and tests only).");
        }

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserRoleResolver, DatabaseUserRoleResolver>();
        services.AddScoped<IClaimsTransformation, RoleClaimsTransformation>();

        if (auth.Enabled)
        {
            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.Authority = auth.Issuer;
                    options.Audience = auth.Audience;
                    // Keep JWT claim names ("sub", "email") instead of the legacy SOAP-style URIs.
                    options.MapInboundClaims = false;
                    options.TokenValidationParameters.ValidIssuer = auth.Issuer;
                    options.TokenValidationParameters.NameClaimType = GameShelfClaims.Subject;
                    options.TokenValidationParameters.RoleClaimType = GameShelfClaims.Role;
                });
        }
        else
        {
            services
                .AddAuthentication(DisabledAuthenticationHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, DisabledAuthenticationHandler>(DisabledAuthenticationHandler.SchemeName, null);
        }

        services.AddAuthorizationBuilder()
            .AddPolicy(AuthPolicies.Reader, policy => policy
                .RequireAuthenticatedUser()
                .RequireClaim(GameShelfClaims.Role, nameof(UserRole.Reader), nameof(UserRole.Curator)))
            .AddPolicy(AuthPolicies.Curator, policy => policy
                .RequireAuthenticatedUser()
                .RequireClaim(GameShelfClaims.Role, nameof(UserRole.Curator)))
            // Secure by default: endpoints without their own [Authorize] still require a signed-in caller.
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        return services;
    }
}
