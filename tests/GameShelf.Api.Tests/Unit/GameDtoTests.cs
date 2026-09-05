using GameShelf.Api.Models;

namespace GameShelf.Api.Tests.Unit;

public class GameDtoTests
{
    [Fact]
    public void From_CopiesEveryField()
    {
        var added = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
        var game = new Game
        {
            Id = 3,
            Title = "Metroid Prime",
            Platform = "GameCube",
            Condition = GameCondition.Fair,
            EstimatedValue = 45.5m,
            AddedDate = added,
        };

        var dto = GameDto.From(game);

        dto.Should().Be(new GameDto(3, "Metroid Prime", "GameCube", GameCondition.Fair, 45.5m, added));
    }
}
