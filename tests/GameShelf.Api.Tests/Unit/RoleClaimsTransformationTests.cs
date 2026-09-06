using System.Security.Claims;
using GameShelf.Api.Auth;
using GameShelf.Api.Models;
using NSubstitute;

namespace GameShelf.Api.Tests.Unit;

public class RoleClaimsTransformationTests
{
    private readonly IUserRoleResolver _resolver = Substitute.For<IUserRoleResolver>();

    private static ClaimsPrincipal Authenticated(params Claim[] claims) =>
        new(new ClaimsIdentity(claims.Append(new Claim(GameShelfClaims.Subject, "alice")), "test"));

    [Fact]
    public async Task AddsRoleClaim_WhenResolverReturnsARole()
    {
        _resolver.ResolveAsync(Arg.Any<ClaimsPrincipal>(), Arg.Any<CancellationToken>()).Returns(UserRole.Curator);

        var result = await new RoleClaimsTransformation(_resolver).TransformAsync(Authenticated());

        result.FindFirstValue(GameShelfClaims.Role).Should().Be("Curator");
        result.Identity!.IsAuthenticated.Should().BeTrue("the original identity stays primary");
    }

    [Fact]
    public async Task LeavesPrincipalWithoutRole_WhenResolverReturnsNull()
    {
        _resolver.ResolveAsync(Arg.Any<ClaimsPrincipal>(), Arg.Any<CancellationToken>()).Returns((UserRole?)null);

        var result = await new RoleClaimsTransformation(_resolver).TransformAsync(Authenticated());

        result.HasClaim(c => c.Type == GameShelfClaims.Role).Should().BeFalse();
    }

    [Fact]
    public async Task SkipsUnauthenticatedPrincipals()
    {
        var anonymous = new ClaimsPrincipal(new ClaimsIdentity());

        var result = await new RoleClaimsTransformation(_resolver).TransformAsync(anonymous);

        result.Should().BeSameAs(anonymous);
        await _resolver.DidNotReceive().ResolveAsync(Arg.Any<ClaimsPrincipal>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DoesNotResolveTwice_WhenARoleClaimIsAlreadyPresent()
    {
        var principal = Authenticated(new Claim(GameShelfClaims.Role, "Reader"));

        var result = await new RoleClaimsTransformation(_resolver).TransformAsync(principal);

        result.FindAll(GameShelfClaims.Role).Should().ContainSingle().Which.Value.Should().Be("Reader");
        await _resolver.DidNotReceive().ResolveAsync(Arg.Any<ClaimsPrincipal>(), Arg.Any<CancellationToken>());
    }
}
