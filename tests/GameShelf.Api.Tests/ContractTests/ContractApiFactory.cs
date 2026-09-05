using GameShelf.Api.Data;
using GameShelf.Api.Health;
using GameShelf.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;

namespace GameShelf.Api.Tests.ContractTests;

/// <summary>
/// Boots the real HTTP pipeline (routing, model binding, validation, JSON) with every
/// data dependency replaced by a substitute. Contract tests assert the *shape* of the API —
/// routes, status codes, response envelopes — never business logic or persistence.
/// </summary>
public class ContractApiFactory : WebApplicationFactory<Program>
{
    // Tripwire: nothing in a contract test should ever open a database connection.
    // If it does, this address fails immediately instead of hanging.
    private const string UnroutableConnectionString =
        "Server=tcp:0.0.0.0,1;Database=never;User Id=x;Password=x;Connect Timeout=1;Encrypt=False";

    public IGameRepository Games { get; } = Substitute.For<IGameRepository>();
    public IReadinessProbe Readiness { get; } = Substitute.For<IReadinessProbe>();

    public ContractApiFactory()
    {
        Games.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<Game>());
        Readiness.CheckAsync(Arg.Any<CancellationToken>()).Returns(new ReadinessResult(true, "stub"));
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:GameShelf", UnroutableConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IGameRepository>();
            services.AddSingleton(Games);

            services.RemoveAll<IReadinessProbe>();
            services.AddSingleton(Readiness);
        });
    }
}
