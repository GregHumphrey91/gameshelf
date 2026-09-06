using System.Security.Claims;
using GameShelf.Api.Auth;
using GameShelf.Api.Data;
using GameShelf.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace GameShelf.Api.Tests.Unit;

public class DatabaseUserRoleResolverTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 5, 12, 0, 0, TimeSpan.Zero);

    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly AuthOptions _options = new();

    private DatabaseUserRoleResolver CreateSut() =>
        new(_users, Options.Create(_options), new FakeTimeProvider(Now), NullLogger<DatabaseUserRoleResolver>.Instance);

    private static ClaimsPrincipal Principal(string? subject, string? email = null)
    {
        var claims = new List<Claim>();
        if (subject is not null) claims.Add(new Claim(GameShelfClaims.Subject, subject));
        if (email is not null) claims.Add(new Claim(GameShelfClaims.Email, email));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
    }

    [Fact]
    public async Task KnownSubject_ReturnsRoleFromTable()
    {
        _users.FindBySubjectAsync("alice", Arg.Any<CancellationToken>())
            .Returns(new User { OktaSubject = "alice", Role = UserRole.Reader });

        var role = await CreateSut().ResolveAsync(Principal("alice"), CancellationToken.None);

        role.Should().Be(UserRole.Reader);
        await _users.DidNotReceive().AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UnknownSubject_ReturnsNull_AndCreatesNothing()
    {
        _users.FindBySubjectAsync("nobody", Arg.Any<CancellationToken>()).Returns((User?)null);

        var role = await CreateSut().ResolveAsync(Principal("nobody"), CancellationToken.None);

        role.Should().BeNull();
        await _users.DidNotReceive().AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MissingSubjectClaim_ReturnsNull_WithoutTouchingTheRepository()
    {
        var role = await CreateSut().ResolveAsync(Principal(subject: null), CancellationToken.None);

        role.Should().BeNull();
        await _users.DidNotReceive().FindBySubjectAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BootstrapSubject_IsCreatedAsCurator_CaseInsensitively()
    {
        _options.BootstrapCurators = ["Owner@Example.com"];
        _users.FindBySubjectAsync("owner@example.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        _users.AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>()).Returns(call => call.Arg<User>());

        var role = await CreateSut().ResolveAsync(Principal("owner@example.com"), CancellationToken.None);

        role.Should().Be(UserRole.Curator);
        await _users.Received(1).AddAsync(
            Arg.Is<User>(u => u.OktaSubject == "owner@example.com"
                              && u.Email == "owner@example.com"
                              && u.Role == UserRole.Curator
                              && u.CreatedAt == Now.UtcDateTime),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BootstrapEmailClaim_IsCreatedAsCurator_WhenSubjectIsOpaque()
    {
        _options.BootstrapCurators = ["owner@example.com"];
        _users.FindBySubjectAsync("00u123", Arg.Any<CancellationToken>()).Returns((User?)null);
        _users.AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>()).Returns(call => call.Arg<User>());

        var role = await CreateSut().ResolveAsync(Principal("00u123", email: "owner@example.com"), CancellationToken.None);

        role.Should().Be(UserRole.Curator);
        await _users.Received(1).AddAsync(
            Arg.Is<User>(u => u.OktaSubject == "00u123" && u.Email == "owner@example.com"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ConcurrentFirstLogin_FallsBackToTheRowThatWon()
    {
        _options.BootstrapCurators = ["owner@example.com"];
        _users.FindBySubjectAsync("owner@example.com", Arg.Any<CancellationToken>())
            .Returns(null, new User { OktaSubject = "owner@example.com", Role = UserRole.Curator });
        _users.AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
            .Returns<User>(_ => throw new DbUpdateException("duplicate key"));

        var role = await CreateSut().ResolveAsync(Principal("owner@example.com"), CancellationToken.None);

        role.Should().Be(UserRole.Curator);
        await _users.Received(2).FindBySubjectAsync("owner@example.com", Arg.Any<CancellationToken>());
    }
}
