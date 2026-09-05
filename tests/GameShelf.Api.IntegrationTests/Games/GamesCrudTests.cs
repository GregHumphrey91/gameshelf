using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using GameShelf.Api.Models;

namespace GameShelf.Api.IntegrationTests.Games;

[Collection(IntegrationCollection.Name)]
public class GamesCrudTests(IntegrationApiFactory factory) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly HttpClient _client = factory.CreateClient();

    public Task InitializeAsync() => factory.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Create_ThenGetById_RoundTripsThroughTheDatabase()
    {
        var before = DateTime.UtcNow.AddSeconds(-5);

        var create = await _client.PostAsJsonAsync("/api/games", new GameWriteRequest
        {
            Title = "EarthBound",
            Platform = "SNES",
            Condition = GameCondition.Good,
            EstimatedValue = 250.00m,
        }, Json);

        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = (await create.Content.ReadFromJsonAsync<GameDto>(Json))!;
        created.Id.Should().BePositive();
        created.AddedDate.Should().BeAfter(before);

        var fetched = await _client.GetFromJsonAsync<GameDto>($"/api/games/{created.Id}", Json);

        fetched.Should().Be(created);
        fetched!.AddedDate.Kind.Should().Be(DateTimeKind.Utc);

        // The wire format must carry the UTC marker, otherwise browsers parse it as local time.
        var raw = await _client.GetStringAsync($"/api/games/{created.Id}");
        raw.Should().MatchRegex("\"addedDate\":\"[^\"]+Z\"");
    }

    [Fact]
    public async Task Update_PersistsChanges_AndPreservesAddedDate()
    {
        var created = await CreateAsync("Halo", "Xbox", GameCondition.Fair, 10m);

        var update = await _client.PutAsJsonAsync($"/api/games/{created.Id}", new GameWriteRequest
        {
            Title = "Halo: Combat Evolved",
            Platform = "Xbox",
            Condition = GameCondition.Mint,
            EstimatedValue = 35m,
        }, Json);

        update.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var fetched = (await _client.GetFromJsonAsync<GameDto>($"/api/games/{created.Id}", Json))!;
        fetched.Title.Should().Be("Halo: Combat Evolved");
        fetched.Condition.Should().Be(GameCondition.Mint);
        fetched.EstimatedValue.Should().Be(35m);
        fetched.AddedDate.Should().Be(created.AddedDate);
    }

    [Fact]
    public async Task Delete_RemovesRow_AndSubsequentGetIs404()
    {
        var created = await CreateAsync("Doom", "PC", GameCondition.Poor, 1m);

        var delete = await _client.DeleteAsync($"/api/games/{created.Id}");
        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var fetch = await _client.GetAsync($"/api/games/{created.Id}");
        fetch.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var deleteAgain = await _client.DeleteAsync($"/api/games/{created.Id}");
        deleteAgain.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetAll_ReturnsEveryRow_NewestFirst()
    {
        var first = await CreateAsync("A", "P", GameCondition.Good, 1m);
        var second = await CreateAsync("B", "P", GameCondition.Good, 2m);

        var all = (await _client.GetFromJsonAsync<List<GameDto>>("/api/games", Json))!;

        all.Should().HaveCount(2);
        all.Select(g => g.Id).Should().ContainInOrder(second.Id, first.Id);
    }

    [Fact]
    public async Task Update_ReturnsNotFound_ForMissingId()
    {
        var response = await _client.PutAsJsonAsync("/api/games/999999", new GameWriteRequest
        {
            Title = "Ghost",
            Platform = "None",
            Condition = GameCondition.Good,
        }, Json);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private async Task<GameDto> CreateAsync(string title, string platform, GameCondition condition, decimal value)
    {
        var response = await _client.PostAsJsonAsync("/api/games", new GameWriteRequest
        {
            Title = title,
            Platform = platform,
            Condition = condition,
            EstimatedValue = value,
        }, Json);

        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<GameDto>(Json))!;
    }
}
