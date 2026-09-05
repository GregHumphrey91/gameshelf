using GameShelf.Api.Controllers;
using GameShelf.Api.Health;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace GameShelf.Api.Tests.Unit;

public class HealthControllerTests
{
    private readonly IReadinessProbe _probe = Substitute.For<IReadinessProbe>();

    [Fact]
    public void Live_AlwaysReturnsOk()
    {
        var sut = new HealthController(_probe);

        sut.Live().Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Ready_ReturnsOk_WhenProbeSucceeds()
    {
        _probe.CheckAsync(Arg.Any<CancellationToken>()).Returns(new ReadinessResult(true, "ok"));
        var sut = new HealthController(_probe);

        var result = await sut.Ready(CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Ready_Returns503_WhenProbeFails()
    {
        _probe.CheckAsync(Arg.Any<CancellationToken>()).Returns(new ReadinessResult(false, "down"));
        var sut = new HealthController(_probe);

        var result = await sut.Ready(CancellationToken.None);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
    }
}
