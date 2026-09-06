namespace GameShelf.Api.Auth;

/// <summary>Claim types the API reads. JWT claims keep their original names (inbound claim mapping is off).</summary>
public static class GameShelfClaims
{
    public const string Subject = "sub";
    public const string Email = "email";

    /// <summary>Added by <see cref="RoleClaimsTransformation"/> from the Users table. Never present in an incoming token.</summary>
    public const string Role = "gameshelf:role";
}

public static class AuthPolicies
{
    /// <summary>Reader or Curator.</summary>
    public const string Reader = "Reader";

    /// <summary>Curator only.</summary>
    public const string Curator = "Curator";
}
