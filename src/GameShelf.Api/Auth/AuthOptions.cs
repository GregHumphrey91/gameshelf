namespace GameShelf.Api.Auth;

/// <summary>Bound from the <c>Auth</c> configuration section (<c>Auth__Enabled</c>, <c>Auth__Issuer</c>, … as environment variables).</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>
    /// When false, no identity provider is contacted and every request runs as a local Curator.
    /// For local development and automated tests only; startup refuses this in Production.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>OpenID Connect issuer, e.g. <c>https://your-org.okta.com/oauth2/default</c>. Signing keys are discovered from it.</summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>Expected <c>aud</c> claim of access tokens. Okta's default authorization server uses <c>api://default</c>.</summary>
    public string Audience { get; set; } = "api://default";

    /// <summary>
    /// Subjects (or e-mail addresses) that are created in the Users table as Curator the first time they
    /// sign in. This is how the first account gets access without hand-written SQL; everyone else is
    /// added by a Curator later.
    /// </summary>
    public string[] BootstrapCurators { get; set; } = [];
}
