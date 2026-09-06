using System.Text.Json.Serialization;
using GameShelf.Api.Auth;
using GameShelf.Api.Data;
using GameShelf.Api.Health;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// --- Configuration ---------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("GameShelf")
    ?? throw new InvalidOperationException(
        "Connection string 'GameShelf' is missing. Set ConnectionStrings__GameShelf (env) or ConnectionStrings:GameShelf (appsettings).");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

// --- Services --------------------------------------------------------------
builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<GameShelfDbContext>(options => options.UseSqlServer(connectionString, sql =>
    sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null)));

builder.Services.AddScoped<IGameRepository, GameRepository>();
builder.Services.AddScoped<IReadinessProbe, SqlReadinessProbe>();
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddGameShelfAuth(builder.Configuration, builder.Environment);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    });
});

var app = builder.Build();

if (!app.Services.GetRequiredService<IOptions<AuthOptions>>().Value.Enabled)
{
    app.Logger.LogWarning("Authentication is DISABLED (Auth:Enabled=false): every request runs as a local Curator");
}

// --- Startup migrations (local dev convenience only) ------------------------
// In cloud environments migrations are a separate, explicit pipeline step.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<GameShelfDbContext>();
    await db.Database.MigrateAsync();
}

// --- Pipeline --------------------------------------------------------------
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Exposes the entry point to WebApplicationFactory<Program> in the test projects.
public partial class Program;
