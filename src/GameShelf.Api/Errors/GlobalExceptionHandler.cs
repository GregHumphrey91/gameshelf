using GameShelf.Api.Middleware;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace GameShelf.Api.Errors;

/// <summary>
/// Turns an unhandled exception into RFC 7807 ProblemDetails rather than an empty 500.
///
/// The message is deliberately generic outside Development: an exception message can carry
/// a connection string, a file path or a schema detail. The correlation id is what makes
/// the response actionable without leaking any of that — it is enough to find the full
/// exception in the logs.
/// </summary>
public class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    IHostEnvironment environment,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var correlationId =
            httpContext.Items[CorrelationIdMiddleware.HeaderName] as string
            ?? httpContext.TraceIdentifier;

        logger.LogError(
            exception,
            "Unhandled exception for {Method} {Path} ({CorrelationId})",
            httpContext.Request.Method, httpContext.Request.Path, correlationId);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
                Detail = environment.IsDevelopment() ? exception.Message : null,
                Instance = httpContext.Request.Path,
            },
        });
    }
}
