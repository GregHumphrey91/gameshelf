using GameShelf.Api.Controllers;
using GameShelf.Api.Data;
using GameShelf.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace GameShelf.Api.Tests.Unit;

public class GamesControllerTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 5, 12, 0, 0, TimeSpan.Zero);

    private readonly IGameRepository _repo = Substitute.For<IGameRepository>();
    private readonly FakeTimeProvider _clock = new(Now);
    private readonly GamesController _sut;

    public GamesControllerTests()
    {
        _sut = new GamesController(_repo, _clock);
    }

    [Fact]
    public async Task GetAll_ReturnsMappedDtos()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<Game>
        {
            new() { Id = 1, Title = "Chrono Trigger", Platform = "SNES", Condition = GameCondition.Good, EstimatedValue = 120m, AddedDate = Now.UtcDateTime },
        });

        var result = await _sut.GetAll(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dtos = ok.Value.Should().BeAssignableTo<IEnumerable<GameDto>>().Subject.ToList();
        dtos.Should().ContainSingle().Which.Should().Be(new GameDto(1, "Chrono Trigger", "SNES", GameCondition.Good, 120m, Now.UtcDateTime));
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_WhenMissing()
    {
        _repo.GetByIdAsync(42, Arg.Any<CancellationToken>()).Returns((Game?)null);

        var result = await _sut.GetById(42, CancellationToken.None);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Create_StampsAddedDateFromClock_AndTrimsInput()
    {
        _repo.AddAsync(Arg.Any<Game>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var g = call.Arg<Game>();
                g.Id = 7;
                return g;
            });

        var request = new GameWriteRequest
        {
            Title = "  Halo  ",
            Platform = " Xbox ",
            Condition = GameCondition.Mint,
            EstimatedValue = 30m,
        };

        var result = await _sut.Create(request, CancellationToken.None);

        var created = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.ActionName.Should().Be(nameof(GamesController.GetById));
        created.RouteValues.Should().ContainKey("id").WhoseValue.Should().Be(7);

        var dto = created.Value.Should().BeOfType<GameDto>().Subject;
        dto.Title.Should().Be("Halo");
        dto.Platform.Should().Be("Xbox");
        dto.AddedDate.Should().Be(Now.UtcDateTime);

        await _repo.Received(1).AddAsync(Arg.Is<Game>(g => g.AddedDate == Now.UtcDateTime), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(true, StatusCodes.Status204NoContent)]
    [InlineData(false, StatusCodes.Status404NotFound)]
    public async Task Update_MapsRepositoryResultToStatus(bool updated, int expectedStatus)
    {
        _repo.UpdateAsync(Arg.Any<Game>(), Arg.Any<CancellationToken>()).Returns(updated);

        var result = await _sut.Update(5, new GameWriteRequest { Title = "T", Platform = "P" }, CancellationToken.None);

        result.Should().BeAssignableTo<StatusCodeResult>().Which.StatusCode.Should().Be(expectedStatus);
        await _repo.Received(1).UpdateAsync(Arg.Is<Game>(g => g.Id == 5), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(true, StatusCodes.Status204NoContent)]
    [InlineData(false, StatusCodes.Status404NotFound)]
    public async Task Delete_MapsRepositoryResultToStatus(bool deleted, int expectedStatus)
    {
        _repo.DeleteAsync(9, Arg.Any<CancellationToken>()).Returns(deleted);

        var result = await _sut.Delete(9, CancellationToken.None);

        result.Should().BeAssignableTo<StatusCodeResult>().Which.StatusCode.Should().Be(expectedStatus);
    }
}
