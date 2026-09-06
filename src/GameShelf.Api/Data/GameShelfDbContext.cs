using GameShelf.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GameShelf.Api.Data;

public class GameShelfDbContext(DbContextOptions<GameShelfDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(u => u.Id);
            entity.Property(u => u.OktaSubject).IsRequired().HasMaxLength(256);
            entity.Property(u => u.Email).IsRequired().HasMaxLength(320);
            entity.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
            entity.Property(u => u.CreatedAt)
                .IsRequired()
                .HasConversion(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
            // One row per identity-provider subject; the resolver relies on this to serialise first-login races.
            entity.HasIndex(u => u.OktaSubject).IsUnique();
        });

        modelBuilder.Entity<Game>(entity =>
        {
            entity.ToTable("Games");
            entity.HasKey(g => g.Id);
            entity.Property(g => g.Title).IsRequired().HasMaxLength(200);
            entity.Property(g => g.Platform).IsRequired().HasMaxLength(100);
            entity.Property(g => g.Condition).HasConversion<string>().HasMaxLength(20);
            entity.Property(g => g.EstimatedValue).HasPrecision(10, 2);
            // Timestamps are stored as UTC. SQL Server's datetime2 has no offset, so EF reads values back
            // as Kind=Unspecified; re-tagging them as UTC keeps the API emitting a trailing "Z".
            entity.Property(g => g.AddedDate)
                .IsRequired()
                .HasConversion(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
            entity.HasIndex(g => g.Title);
        });
    }
}
