using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GameShelf.Api.Data;

// Lets `dotnet ef migrations add` run without a live database or host startup.
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<GameShelfDbContext>
{
    public GameShelfDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<GameShelfDbContext>()
            .UseSqlServer("Server=localhost;Database=gameshelf;Trusted_Connection=False;Encrypt=False")
            .Options;
        return new GameShelfDbContext(options);
    }
}
