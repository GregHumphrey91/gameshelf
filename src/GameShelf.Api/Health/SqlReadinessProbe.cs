using GameShelf.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GameShelf.Api.Health;

// A real round-trip to the database. Deployment-slot warmup pings this, so it must
// fail when the database is unreachable rather than returning a canned success.
public class SqlReadinessProbe(GameShelfDbContext db, ILogger<SqlReadinessProbe> logger) : IReadinessProbe
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public async Task<ReadinessResult> CheckAsync(CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(Timeout);

        try
        {
            await db.Database.ExecuteSqlRawAsync("SELECT 1", timeout.Token);
            return new ReadinessResult(true, "database reachable");
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Readiness probe failed");
            return new ReadinessResult(false, "database unreachable");
        }
    }
}
