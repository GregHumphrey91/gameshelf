using GameShelf.Api.Auth;
using GameShelf.Api.Data;
using GameShelf.Api.Health;
using GameShelf.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;

namespace GameShelf.Api.Tests.ContractTests;

/// <summary>
/// Boots the real HTTP pipeline (routing, model binding, validation, JSON, authentication and
/// authorization) with every data dependency replaced by a substitute. Contract tests assert the
/// *shape* of the API — routes, status codes, response envelopes — never business logic or persistence.
///
/// Authentication runs with <c>Auth:Enabled=true</c> so the real policies apply, but the JWT scheme is
/// swapped for <see cref="TestAuthHandler"/> and the database role lookup for <see cref="FakeRoleResolver"/>.
/// Use <see cref="CreateClientAs"/> to call as one of <see cref="TestUsers"/>; a plain
/// <see cref="WebApplicationFactory{TEntryPoint}.CreateClient()"/> is anonymous.
/// </summary>
public class ContractApiFactory : WebApplicationFactory<Program>
{
    // Tripwire: nothing in a contract test should ever open a database connection.
    // If it does, this address fails immediately instead of hanging.
    private const string UnroutableConnectionString =
        "Server=tcp:0.0.0.0,1;Database=never;User Id=x;Password=x;Connect Timeout=1;Encrypt=False";

    public IGameRepository Games { get; } = Substitute.For<IGameRepository>();
    public IReadinessProbe Readiness { get; } = Substitute.For<IReadinessProbe>();
    public FakeRoleResolver Roles { get; } = new();

    public ContractApiFactory()
    {
        Games.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<Game>());
        Readiness.CheckAsync(Arg.Any<CancellationToken>()).Returns(new ReadinessResult(true, "stub"));
    }

    public HttpClient CreateClientAs(string subject)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubjectHeader, subject);
        return client;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:GameShelf", UnroutableConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
        // Real authorization pipeline; the issuer is never contacted because the scheme is replaced below.
        builder.UseSetting("Auth:Enabled", "true");
        builder.UseSetting("Auth:Issuer", "https://contract-tests.invalid/oauth2/default");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IGameRepository>();
            services.AddSingleton(Games);

            services.RemoveAll<IReadinessProbe>();
            services.AddSingleton(Readiness);

            services.RemoveAll<IUserRepository>();
            services.RemoveAll<IUserRoleResolver>();
            services.AddSingleton<IUserRoleResolver>(Roles);

            // Registered after the app's own AddAuthentication, so this becomes the default scheme.
            services
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null);
        });
    }
}
