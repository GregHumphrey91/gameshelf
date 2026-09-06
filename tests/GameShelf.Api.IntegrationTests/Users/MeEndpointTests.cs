using System.Net;
using System.Text.Json;
using GameShelf.Api.Auth;

namespace GameShelf.Api.IntegrationTests.Users;

[Collection(IntegrationCollection.Name)]
public class MeEndpointTests(IntegrationApiFactory factory)
{
    [Fact]
    public async Task WithAuthDisabled_EveryCallerIsTheLocalCurator()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("subject").GetString().Should().Be(DisabledAuthenticationHandler.Subject);
        json.RootElement.GetProperty("email").GetString().Should().Be(DisabledAuthenticationHandler.Email);
        json.RootElement.GetProperty("role").GetString().Should().Be("Curator");
    }
}
