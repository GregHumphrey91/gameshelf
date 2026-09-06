using GameShelf.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GameShelf.Api.Data;

public class UserRepository(GameShelfDbContext db) : IUserRepository
{
    public Task<User?> FindBySubjectAsync(string subject, CancellationToken ct) =>
        db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.OktaSubject == subject, ct);

    public async Task<User> AddAsync(User user, CancellationToken ct)
    {
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return user;
    }
}
