namespace GameShelf.Api.Models;

public class Game
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public GameCondition Condition { get; set; }
    public decimal EstimatedValue { get; set; }
    public DateTime AddedDate { get; set; }
}

public enum GameCondition
{
    Mint,
    Good,
    Fair,
    Poor
}
