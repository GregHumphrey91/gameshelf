using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GameShelf.Api.Models;
using NSubstitute;

namespace GameShelf.Api.Tests.ContractTests;

public class GamesContractTests(ContractApiFactory factory) : IClassFixture<ContractApiFactory>
{
    private static readonly string[] ExpectedGameProperties =
        ["id", "title", "platform", "condition", "estimatedValue", "addedDate"];

    private readonly HttpClient _client = factory.CreateClient();

    private static Game SampleGame(int id = 1) => new()
    {
        Id = id,
        Title = "Ocarina of Time",
        Platform = "N64",
        Condition = GameCondition.Good,
        EstimatedValue = 60m,
        AddedDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
    };

    [Fact]
    public async Task GetAll_Returns200_WithJsonArrayOfGames()
    {
        factory.Games.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<Game> { SampleGame() });

        var response = await _client.GetAsync("/api/games");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/json");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.ValueKind.Should().Be(JsonValueKind.Array);
        var first = json.RootElement[0];
        first.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo(ExpectedGameProperties);
        first.GetProperty("condition").GetString().Should().Be("Good", "enums are serialized as strings");
        first.GetProperty("estimatedValue").GetDecimal().Should().Be(60m);
    }

    [Fact]
    public async Task GetById_Returns404_WhenRepositoryReturnsNull()
    {
        factory.Games.GetByIdAsync(404, Arg.Any<CancellationToken>()).Returns((Game?)null);

        var response = await _client.GetAsync("/api/games/404");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetById_Returns200_WithGameShape()
    {
        factory.Games.GetByIdAsync(1, Arg.Any<CancellationToken>()).Returns(SampleGame());

        var response = await _client.GetAsync("/api/games/1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo(ExpectedGameProperties);
    }

    [Fact]
    public async Task GetById_Returns404_ForNonNumericId()
    {
        var response = await _client.GetAsync("/api/games/not-a-number");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Create_Returns201_WithLocationHeader_AndBody()
    {
        factory.Games.AddAsync(Arg.Any<Game>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var g = call.Arg<Game>();
                g.Id = 99;
                return g;
            });

        var response = await _client.PostAsJsonAsync("/api/games", new
        {
            title = "Super Metroid",
            platform = "SNES",
            condition = "Mint",
            estimatedValue = 80.25,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location!.PathAndQuery.Should().Be("/api/games/99");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("id").GetInt32().Should().Be(99);
        json.RootElement.GetProperty("condition").GetString().Should().Be("Mint");
    }

    [Fact]
    public async Task Create_Returns400ValidationProblem_WhenTitleMissing()
    {
        var response = await _client.PostAsJsonAsync("/api/games", new
        {
            title = "",
            platform = "SNES",
            condition = "Good",
            estimatedValue = 10,
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("status").GetInt32().Should().Be(400);
        json.RootElement.GetProperty("errors").TryGetProperty("Title", out _).Should().BeTrue();
    }

    [Fact]
    public async Task Create_Returns400_WhenConditionIsUnknownValue()
    {
        var response = await _client.PostAsJsonAsync("/api/games", new
        {
            title = "X",
            platform = "Y",
            condition = "Shredded",
            estimatedValue = 1,
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData(true, HttpStatusCode.NoContent)]
    [InlineData(false, HttpStatusCode.NotFound)]
    public async Task Update_MapsRepositoryResult(bool updated, HttpStatusCode expected)
    {
        factory.Games.UpdateAsync(Arg.Any<Game>(), Arg.Any<CancellationToken>()).Returns(updated);

        var response = await _client.PutAsJsonAsync("/api/games/5", new
        {
            title = "Updated",
            platform = "PS2",
            condition = "Fair",
            estimatedValue = 5,
        });

        response.StatusCode.Should().Be(expected);
    }

    [Theory]
    [InlineData(true, HttpStatusCode.NoContent)]
    [InlineData(false, HttpStatusCode.NotFound)]
    public async Task Delete_MapsRepositoryResult(bool deleted, HttpStatusCode expected)
    {
        factory.Games.DeleteAsync(Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns(deleted);

        var response = await _client.DeleteAsync("/api/games/5");

        response.StatusCode.Should().Be(expected);
    }

    [Fact]
    public async Task UnknownRoute_Returns404()
    {
        var response = await _client.GetAsync("/api/does-not-exist");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
