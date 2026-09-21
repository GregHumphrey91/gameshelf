namespace GameShelf.Api.Middleware;

/// <summary>
/// Gives every request an id that survives from the browser to the logs.
///
/// Honours an inbound X-Correlation-Id so a SPA-initiated request can be followed all the
/// way through, and echoes it on the response so a user can quote it. Without this, tying a
/// user's report to a log line means guessing from timestamps.
/// </summary>
public class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context, ILogger<CorrelationIdMiddleware> logger)
    {
        var correlationId = context.Request.Headers[HeaderName].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(correlationId)) correlationId = context.TraceIdentifier;

        context.Items[HeaderName] = correlationId;

        // Set before the response starts: headers cannot be added once writing has begun.
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        using (logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
        {
            await next(context);
        }
    }
}
