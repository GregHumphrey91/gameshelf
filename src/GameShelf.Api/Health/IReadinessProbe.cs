namespace GameShelf.Api.Health;

public interface IReadinessProbe
{
    Task<ReadinessResult> CheckAsync(CancellationToken ct);
}

public record ReadinessResult(bool IsReady, string Detail);
