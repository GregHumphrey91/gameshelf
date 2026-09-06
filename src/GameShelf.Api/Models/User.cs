namespace GameShelf.Api.Models;

/// <summary>
/// An account that may use the API. Identity (who you are) comes from the identity provider's token;
/// authorization (what you may do) comes from <see cref="Role"/> in this table — never from token claims.
/// </summary>
public class User
{
    public int Id { get; set; }

    /// <summary>The <c>sub</c> claim of the caller's access token.</summary>
    public string OktaSubject { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    public DateTime CreatedAt { get; set; }
}

public enum UserRole
{
    /// <summary>May list and view games.</summary>
    Reader,

    /// <summary>May also create, update and delete games.</summary>
    Curator,
}
