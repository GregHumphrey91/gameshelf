using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GameShelf.Api.IntegrationTests;

[Collection(IntegrationCollection.Name)]
public class HealthReadyTests(IntegrationApiFactory factory)
{
    [Fact]
    public async Task Ready_Returns200_WhenDatabaseIsReachable()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Ready_Returns503_WhenDatabaseIsUnreachable()
    {
        // Same app, but pointed at an address nothing listens on. This is the case a
        // deployment-slot warmup ping must catch: a broken build must never report ready.
        using var broken = factory.WithWebHostBuilder(builder =>
            builder.UseSetting(
                "ConnectionStrings:GameShelf",
                "Server=tcp:0.0.0.0,1;Database=never;User Id=x;Password=x;Connect Timeout=1;Encrypt=False"));

        var client = broken.CreateClient();

        var response = await client.GetAsync("/health/ready");

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }
}
