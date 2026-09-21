using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GameShelf.Api.Data;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace GameShelf.Api.Tests.ContractTests;

public class ObservabilityContractTests(ContractApiFactory factory) : IClassFixture<ContractApiFactory>
{
    private const string CorrelationHeader = "X-Correlation-Id";

    private readonly HttpClient _client = factory.CreateClientAs(TestUsers.Curator);

    [Fact]
    public async Task EveryResponse_CarriesACorrelationId()
    {
        var response = await _client.GetAsync("/api/games");

        response.Headers.GetValues(CorrelationHeader).Single().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task InboundCorrelationId_IsHonoured_NotReplaced()
    {
        // The caller generates one so a report can be traced end to end. Overwriting it would
        // break the only link between what they saw and what was logged.
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/games");
        request.Headers.Add(CorrelationHeader, "known-value-123");

        var response = await _client.SendAsync(request);

        response.Headers.GetValues(CorrelationHeader).Single().Should().Be("known-value-123");
    }

    [Theory]
    [InlineData("X-Content-Type-Options", "nosniff")]
    [InlineData("X-Frame-Options", "DENY")]
    [InlineData("Referrer-Policy", "strict-origin-when-cross-origin")]
    public async Task SecurityHeaders_ArePresent(string header, string expected)
    {
        var response = await _client.GetAsync("/api/games");

        response.Headers.GetValues(header).Single().Should().Be(expected);
    }

    [Fact]
    public async Task JsonApi_DeclaresAContentSecurityPolicyOfNone()
    {
        var response = await _client.GetAsync("/api/games");

        response.Headers.GetValues("Content-Security-Policy").Single().Should().Contain("default-src 'none'");
    }

    [Fact]
    public async Task ValidationFailure_IsProblemDetails_WithACorrelationId()
    {
        var response = await _client.PostAsJsonAsync("/api/games", new { title = "" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("correlationId").GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task UnhandledException_Is500ProblemDetails_WithoutTheExceptionMessage()
    {
        factory.Games.GetByIdAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("secret-connection-detail"));

        var response = await _client.GetAsync("/api/games/1");

        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotContain("secret-connection-detail");
        using var json = JsonDocument.Parse(body);
        json.RootElement.GetProperty("correlationId").GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task HealthProbes_StillAnswer_BehindTheSecurityHeaders()
    {
        // The headers middleware runs for every request; a mistake there breaks a swap warmup, not a test.
        var response = await factory.CreateClient().GetAsync("/health/ready");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.GetValues("X-Content-Type-Options").Single().Should().Be("nosniff");
    }
}
