using GameShelf.Api.Models;

namespace GameShelf.Api.Data;

public interface IUserRepository
{
    Task<User?> FindBySubjectAsync(string subject, CancellationToken ct);

    /// <summary>Inserts the user. Throws <see cref="Microsoft.EntityFrameworkCore.DbUpdateException"/> if the subject already exists.</summary>
    Task<User> AddAsync(User user, CancellationToken ct);
}
