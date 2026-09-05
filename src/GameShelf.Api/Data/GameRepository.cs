using GameShelf.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GameShelf.Api.Data;

public class GameRepository(GameShelfDbContext db) : IGameRepository
{
    public async Task<IReadOnlyList<Game>> GetAllAsync(CancellationToken ct) =>
        await db.Games.AsNoTracking().OrderByDescending(g => g.AddedDate).ThenBy(g => g.Id).ToListAsync(ct);

    public Task<Game?> GetByIdAsync(int id, CancellationToken ct) =>
        db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id, ct);

    public async Task<Game> AddAsync(Game game, CancellationToken ct)
    {
        db.Games.Add(game);
        await db.SaveChangesAsync(ct);
        return game;
    }

    public async Task<bool> UpdateAsync(Game game, CancellationToken ct)
    {
        var existing = await db.Games.FirstOrDefaultAsync(g => g.Id == game.Id, ct);
        if (existing is null)
        {
            return false;
        }

        existing.Title = game.Title;
        existing.Platform = game.Platform;
        existing.Condition = game.Condition;
        existing.EstimatedValue = game.EstimatedValue;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var deleted = await db.Games.Where(g => g.Id == id).ExecuteDeleteAsync(ct);
        return deleted > 0;
    }
}
