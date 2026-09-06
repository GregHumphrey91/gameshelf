using System.Security.Claims;
using GameShelf.Api.Auth;
using GameShelf.Api.Data;
using GameShelf.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace GameShelf.Api.IntegrationTests.Users;

/// <summary>
/// The real resolver against the real Users table: the role an authenticated subject gets is exactly
/// what the table says, and a configured bootstrap curator gets a row on first sight.
/// </summary>
[Collection(IntegrationCollection.Name)]
public class RoleResolutionTests(IntegrationApiFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => factory.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private static ClaimsPrincipal PrincipalFor(string subject) =>
        new(new ClaimsIdentity([new Claim(GameShelfClaims.Subject, subject), new Claim(GameShelfClaims.Email, subject)], "test"));

    private static DatabaseUserRoleResolver Resolver(IServiceScope scope, params string[] bootstrapCurators) => new(
        scope.ServiceProvider.GetRequiredService<IUserRepository>(),
        Options.Create(new AuthOptions { BootstrapCurators = bootstrapCurators }),
        TimeProvider.System,
        NullLogger<DatabaseUserRoleResolver>.Instance);

    [Fact]
    public async Task ReturnsTheRoleStoredForTheSubject()
    {
        using var seed = factory.Services.CreateScope();
        var db = seed.ServiceProvider.GetRequiredService<GameShelfDbContext>();
        db.Users.Add(new User { OktaSubject = "reader@example.com", Email = "reader@example.com", Role = UserRole.Reader, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        using var scope = factory.Services.CreateScope();
        var role = await Resolver(scope).ResolveAsync(PrincipalFor("reader@example.com"), CancellationToken.None);

        role.Should().Be(UserRole.Reader);
    }

    [Fact]
    public async Task ReturnsNull_ForSubjectsNotInTheTable()
    {
        using var scope = factory.Services.CreateScope();

        var role = await Resolver(scope).ResolveAsync(PrincipalFor("stranger@example.com"), CancellationToken.None);

        role.Should().BeNull();
        var db = scope.ServiceProvider.GetRequiredService<GameShelfDbContext>();
        (await db.Users.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task BootstrapCurator_GetsARow_OnFirstSight_AndKeepsItAfterwards()
    {
        using var first = factory.Services.CreateScope();
        var role = await Resolver(first, "owner@example.com").ResolveAsync(PrincipalFor("owner@example.com"), CancellationToken.None);
        role.Should().Be(UserRole.Curator);

        // Second resolution, with the bootstrap list now empty: the row, not the config, grants the role.
        using var second = factory.Services.CreateScope();
        var again = await Resolver(second).ResolveAsync(PrincipalFor("owner@example.com"), CancellationToken.None);
        again.Should().Be(UserRole.Curator);

        var db = second.ServiceProvider.GetRequiredService<GameShelfDbContext>();
        var rows = await db.Users.Where(u => u.OktaSubject == "owner@example.com").ToListAsync();
        rows.Should().ContainSingle().Which.Role.Should().Be(UserRole.Curator);
    }
}
