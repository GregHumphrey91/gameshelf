using GameShelf.Api.Auth;
using GameShelf.Api.Data;
using GameShelf.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameShelf.Api.Controllers;

/// <summary>Readers may view the collection; only Curators may change it.</summary>
[ApiController]
[Route("api/games")]
[Authorize(Policy = AuthPolicies.Reader)]
public class GamesController(IGameRepository games, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<GameDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<GameDto>>> GetAll(CancellationToken ct)
    {
        var all = await games.GetAllAsync(ct);
        return Ok(all.Select(GameDto.From));
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(GameDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<GameDto>> GetById(int id, CancellationToken ct)
    {
        var game = await games.GetByIdAsync(id, ct);
        return game is null ? NotFound() : Ok(GameDto.From(game));
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.Curator)]
    [ProducesResponseType(typeof(GameDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<GameDto>> Create([FromBody] GameWriteRequest request, CancellationToken ct)
    {
        var game = new Game
        {
            Title = request.Title.Trim(),
            Platform = request.Platform.Trim(),
            Condition = request.Condition,
            EstimatedValue = request.EstimatedValue,
            AddedDate = clock.GetUtcNow().UtcDateTime,
        };

        var created = await games.AddAsync(game, ct);
        var dto = GameDto.From(created);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.Curator)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] GameWriteRequest request, CancellationToken ct)
    {
        var game = new Game
        {
            Id = id,
            Title = request.Title.Trim(),
            Platform = request.Platform.Trim(),
            Condition = request.Condition,
            EstimatedValue = request.EstimatedValue,
        };

        var updated = await games.UpdateAsync(game, ct);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.Curator)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await games.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
