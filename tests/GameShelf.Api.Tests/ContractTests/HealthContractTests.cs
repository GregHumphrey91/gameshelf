using System.Net;
using System.Text.Json;
using GameShelf.Api.Health;
using NSubstitute;

namespace GameShelf.Api.Tests.ContractTests;

public class HealthContractTests(ContractApiFactory factory) : IClassFixture<ContractApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Live_Returns200()
    {
        var response = await _client.GetAsync("/health/live");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("status").GetString().Should().Be("live");
    }

    [Fact]
    public async Task Ready_Returns200_WhenProbeReportsReady()
    {
        factory.Readiness.CheckAsync(Arg.Any<CancellationToken>()).Returns(new ReadinessResult(true, "ok"));

        var response = await _client.GetAsync("/health/ready");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("status").GetString().Should().Be("ready");
    }

    [Fact]
    public async Task Ready_Returns503_WhenProbeReportsNotReady()
    {
        factory.Readiness.CheckAsync(Arg.Any<CancellationToken>()).Returns(new ReadinessResult(false, "down"));

        var response = await _client.GetAsync("/health/ready");

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("status").GetString().Should().Be("unavailable");
    }
}
