using GameShelf.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GameShelf.Api.IntegrationTests;

/// <summary>
/// Boots the real API against a real SQL Server (the local docker-compose container by default,
/// or whatever <c>GAMESHELF_TEST_CONNECTION_STRING</c> points at in CI). Applies EF Core migrations
/// once per test run, and exposes <see cref="ResetAsync"/> so each test starts from an empty table.
/// </summary>
public class IntegrationApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string DefaultConnectionString =
        "Server=localhost,1433;Database=gameshelf_test;User Id=sa;Password=GameShelf_Dev_Pa55word!;TrustServerCertificate=True;Encrypt=False";

    public static readonly string ConnectionString =
        Environment.GetEnvironmentVariable("GAMESHELF_TEST_CONNECTION_STRING") ?? DefaultConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:GameShelf", ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
    }

    public async Task InitializeAsync()
    {
        await WaitForSqlServerAsync(TimeSpan.FromSeconds(90));

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GameShelfDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task ResetAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GameShelfDbContext>();
        await db.Games.ExecuteDeleteAsync();
    }

    Task IAsyncLifetime.DisposeAsync() => Task.CompletedTask;

    // Connect to `master` rather than the app database: the app database may not exist yet
    // on a fresh container, and MigrateAsync creates it.
    private static async Task WaitForSqlServerAsync(TimeSpan timeout)
    {
        var master = new SqlConnectionStringBuilder(ConnectionString)
        {
            InitialCatalog = "master",
            ConnectTimeout = 3,
        }.ConnectionString;

        var deadline = DateTime.UtcNow + timeout;
        Exception? last = null;

        while (DateTime.UtcNow < deadline)
        {
            try
            {
                await using var conn = new SqlConnection(master);
                await conn.OpenAsync();
                return;
            }
            catch (Exception ex)
            {
                last = ex;
                await Task.Delay(TimeSpan.FromSeconds(2));
            }
        }

        throw new InvalidOperationException(
            $"SQL Server was not reachable within {timeout.TotalSeconds}s. Is the sqlserver container running? " +
            $"(docker compose up -d sqlserver)", last);
    }
}

[CollectionDefinition(Name)]
public class IntegrationCollection : ICollectionFixture<IntegrationApiFactory>
{
    public const string Name = "Integration";
}
