using System.ComponentModel.DataAnnotations;

namespace GameShelf.Api.Models;

public record GameDto(
    int Id,
    string Title,
    string Platform,
    GameCondition Condition,
    decimal EstimatedValue,
    DateTime AddedDate)
{
    public static GameDto From(Game game) => new(
        game.Id,
        game.Title,
        game.Platform,
        game.Condition,
        game.EstimatedValue,
        game.AddedDate);
}

public record GameWriteRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; init; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 1)]
    public string Platform { get; init; } = string.Empty;

    [Required]
    public GameCondition Condition { get; init; }

    [Range(0, 1_000_000)]
    public decimal EstimatedValue { get; init; }
}
