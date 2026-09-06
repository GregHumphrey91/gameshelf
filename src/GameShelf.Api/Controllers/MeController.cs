using GameShelf.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace GameShelf.Api.Controllers;

/// <summary>
/// Who the API thinks the caller is. Requires a valid token but no role, so the SPA can tell a
/// signed-in user with no access ("ask a curator to add you") apart from an unauthenticated one.
/// </summary>
[ApiController]
[Route("api/me")]
public class MeController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(CurrentUserDto), StatusCodes.Status200OK)]
    public ActionResult<CurrentUserDto> Get() => Ok(CurrentUserDto.From(User));
}
