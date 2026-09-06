using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GameShelf.Api.Models;
using NSubstitute;

namespace GameShelf.Api.Tests.ContractTests;

/// <summary>
/// The authorization contract: no credentials → 401; credentials but no role → 403;
/// Reader may read but not write; Curator may do both; /api/me describes the caller; health is public.
/// </summary>
public class AuthContractTests(ContractApiFactory factory) : IClassFixture<ContractApiFactory>
{
    private static readonly object ValidGame = new { title = "Tetris", platform = "Game Boy", condition = "Good", estimatedValue = 12 };

    [Theory]
    [InlineData("GET", "/api/games")]
    [InlineData("GET", "/api/games/1")]
    [InlineData("POST", "/api/games")]
    [InlineData("PUT", "/api/games/1")]
    [InlineData("DELETE", "/api/games/1")]
    [InlineData("GET", "/api/me")]
    public async Task Returns401_WithoutCredentials(string method, string path)
    {
        var client = factory.CreateClient();

        var response = await client.SendAsync(Request(method, path));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("GET", "/api/games")]
    [InlineData("POST", "/api/games")]
    public async Task Returns403_WhenAuthenticatedButNotInUsersTable(string method, string path)
    {
        var client = factory.CreateClientAs(TestUsers.Stranger);

        var response = await client.SendAsync(Request(method, path));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Reader_CanList()
    {
        var client = factory.CreateClientAs(TestUsers.Reader);

        var response = await client.GetAsync("/api/games");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("POST", "/api/games")]
    [InlineData("PUT", "/api/games/1")]
    [InlineData("DELETE", "/api/games/1")]
    public async Task Reader_CannotWrite(string method, string path)
    {
        factory.Games.ClearReceivedCalls(); // the fixture is shared with tests that write as Curator
        var client = factory.CreateClientAs(TestUsers.Reader);

        var response = await client.SendAsync(Request(method, path));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        factory.Games.DidNotReceive().AddAsync(Arg.Any<Game>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Curator_CanWrite()
    {
        factory.Games.AddAsync(Arg.Any<Game>(), Arg.Any<CancellationToken>()).Returns(call => call.Arg<Game>());
        var client = factory.CreateClientAs(TestUsers.Curator);

        var response = await client.PostAsJsonAsync("/api/games", ValidGame);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Me_DescribesTheCaller()
    {
        var client = factory.CreateClientAs(TestUsers.Reader);

        var response = await client.GetAsync("/api/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo(["subject", "email", "role"]);
        json.RootElement.GetProperty("subject").GetString().Should().Be(TestUsers.Reader);
        json.RootElement.GetProperty("role").GetString().Should().Be("Reader");
    }

    [Fact]
    public async Task Me_ReportsNullRole_ForUnknownAccount()
    {
        var client = factory.CreateClientAs(TestUsers.Stranger);

        var response = await client.GetAsync("/api/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK, "a signed-in user with no access must be able to learn that");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("role").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")]
    public async Task Health_IsAnonymous(string path)
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private static HttpRequestMessage Request(string method, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (method is "POST" or "PUT")
        {
            request.Content = JsonContent.Create(ValidGame);
        }

        return request;
    }
}
