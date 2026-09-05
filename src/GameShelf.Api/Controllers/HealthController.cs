using GameShelf.Api.Health;
using Microsoft.AspNetCore.Mvc;

namespace GameShelf.Api.Controllers;

[ApiController]
[Route("health")]
public class HealthController(IReadinessProbe readinessProbe) : ControllerBase
{
    [HttpGet("live")]
    public IActionResult Live() => Ok(new { status = "live" });

    [HttpGet("ready")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Ready(CancellationToken ct)
    {
        var result = await readinessProbe.CheckAsync(ct);
        var body = new { status = result.IsReady ? "ready" : "unavailable", detail = result.Detail };
        return result.IsReady ? Ok(body) : StatusCode(StatusCodes.Status503ServiceUnavailable, body);
    }
}
