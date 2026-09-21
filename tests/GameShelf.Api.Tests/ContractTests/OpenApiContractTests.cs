using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Extensions;
using Swashbuckle.AspNetCore.Swagger;

namespace GameShelf.Api.Tests.ContractTests;

/// <summary>
/// <c>infra/openapi.json</c> is committed, and the frontend's generated types and mock handlers are
/// checked against it. This is the link on the API side: the document the running application
/// produces must equal the committed one, so an API change cannot land without appearing in a diff.
/// </summary>
public class OpenApiContractTests(ContractApiFactory factory) : IClassFixture<ContractApiFactory>
{
    [Fact]
    public void CommittedDocument_MatchesTheRunningApi()
    {
        var live = factory.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");
        var liveJson = JsonNode.Parse(live.SerializeAsJson(Microsoft.OpenApi.OpenApiSpecVersion.OpenApi3_0));
        var committedJson = JsonNode.Parse(File.ReadAllText(FindCommittedDocument()));

        JsonNode.DeepEquals(liveJson, committedJson).Should().BeTrue(
            "infra/openapi.json is out of date — run `npm run openapi:generate` (then `npm run generate:types`) and commit the result");
    }

    private static string FindCommittedDocument()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "infra", "openapi.json");
            if (File.Exists(candidate)) return candidate;
        }

        throw new FileNotFoundException("infra/openapi.json was not found above " + AppContext.BaseDirectory);
    }
}
