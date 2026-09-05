using GameShelf.Api.Models;

namespace GameShelf.Api.Data;

public interface IGameRepository
{
    Task<IReadOnlyList<Game>> GetAllAsync(CancellationToken ct);
    Task<Game?> GetByIdAsync(int id, CancellationToken ct);
    Task<Game> AddAsync(Game game, CancellationToken ct);
    Task<bool> UpdateAsync(Game game, CancellationToken ct);
    Task<bool> DeleteAsync(int id, CancellationToken ct);
}
