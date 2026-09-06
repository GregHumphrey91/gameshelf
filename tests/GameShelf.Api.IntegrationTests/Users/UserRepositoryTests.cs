using GameShelf.Api.Data;
using GameShelf.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GameShelf.Api.IntegrationTests.Users;

[Collection(IntegrationCollection.Name)]
public class UserRepositoryTests(IntegrationApiFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => factory.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private static User Alice() => new()
    {
        OktaSubject = "alice@example.com",
        Email = "alice@example.com",
        Role = UserRole.Reader,
        CreatedAt = new DateTime(2026, 9, 5, 8, 0, 0, DateTimeKind.Utc),
    };

    [Fact]
    public async Task FindBySubject_ReturnsNull_WhenUnknown()
    {
        using var scope = factory.Services.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IUserRepository>();

        var user = await repo.FindBySubjectAsync("nobody@example.com", CancellationToken.None);

        user.Should().BeNull();
    }

    [Fact]
    public async Task Add_ThenFind_RoundTripsThroughTheDatabase()
    {
        using (var scope = factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IUserRepository>().AddAsync(Alice(), CancellationToken.None);
        }

        using var readScope = factory.Services.CreateScope();
        var found = await readScope.ServiceProvider.GetRequiredService<IUserRepository>()
            .FindBySubjectAsync("alice@example.com", CancellationToken.None);

        found.Should().NotBeNull();
        found!.Role.Should().Be(UserRole.Reader);
        found.Email.Should().Be("alice@example.com");
        found.CreatedAt.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public async Task Add_RejectsDuplicateSubject()
    {
        using var scope = factory.Services.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        await repo.AddAsync(Alice(), CancellationToken.None);

        using var second = factory.Services.CreateScope();
        var act = () => second.ServiceProvider.GetRequiredService<IUserRepository>().AddAsync(Alice(), CancellationToken.None);

        await act.Should().ThrowAsync<DbUpdateException>("OktaSubject has a unique index");
    }
}
