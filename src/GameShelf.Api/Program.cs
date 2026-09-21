using System.Text.Json.Serialization;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using GameShelf.Api.Auth;
using GameShelf.Api.Data;
using GameShelf.Api.Errors;
using GameShelf.Api.Health;
using GameShelf.Api.Middleware;
using GameShelf.Api.Swagger;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// --- Logging & telemetry ----------------------------------------------------
// Telemetry is opt-in: everything Azure-bound is gated on the connection string, which is an app
// setting in Azure only. Local runs and every test stack leave it unset, so nothing here dials out.
var appInsightsConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];

builder.Host.UseSerilog((ctx, sp, lc) =>
{
    // Sinks and levels come from the Serilog section: compact JSON to stdout, one event per line.
    lc.ReadFrom.Configuration(ctx.Configuration)
        .ReadFrom.Services(sp)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .Enrich.WithThreadId()
        .Enrich.WithProperty("Service", "gameshelf-api")
        .Enrich.WithProperty("Env", ctx.HostingEnvironment.EnvironmentName);

    if (!string.IsNullOrEmpty(appInsightsConnectionString))
    {
        lc.WriteTo.ApplicationInsights(appInsightsConnectionString, TelemetryConverter.Traces);
    }
});

// Auto-instruments incoming requests, outbound HttpClient calls and SQL.
if (!string.IsNullOrEmpty(appInsightsConnectionString))
{
    builder.Services.AddOpenTelemetry().UseAzureMonitor();
}

// --- Configuration ---------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("GameShelf")
    ?? throw new InvalidOperationException(
        "Connection string 'GameShelf' is missing. Set ConnectionStrings__GameShelf (env) or ConnectionStrings:GameShelf (appsettings).");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

// --- Services --------------------------------------------------------------
builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails(options =>
{
    // Every problem response names the request, so a user's report can be matched to a log line.
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Extensions["correlationId"] =
            ctx.HttpContext.Items[CorrelationIdMiddleware.HeaderName] as string
            ?? ctx.HttpContext.TraceIdentifier;
        ctx.ProblemDetails.Extensions["traceId"] = System.Diagnostics.Activity.Current?.TraceId.ToString();
        ctx.ProblemDetails.Instance ??= ctx.HttpContext.Request.Path;
    };
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "GameShelf API", Version = "v1" });

    // Make the document describe reality: non-nullable reference types and value types are never
    // omitted from a response. Without these two lines every generated client treats the model as partial.
    options.SupportNonNullableReferenceTypes();
    // A property that refers to another schema (an enum, say) is emitted as a bare $ref, and a $ref
    // cannot carry "nullable". Wrapping it in allOf is what lets `UserRole?` on /api/me say it may be null.
    options.UseAllOfToExtendReferenceSchemas();
    options.SchemaFilter<RequiredNotNullableSchemaFilter>();

    options.AddSecurityDefinition("bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "An access token from the configured issuer. Not needed when Auth:Enabled=false.",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "bearer" },
        }] = Array.Empty<string>(),
    });
});

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
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()
                // A cross-origin response hides non-simple headers unless they are exposed; without
                // this the SPA could never read the correlation id off an error it wants to report.
                .WithExposedHeaders(CorrelationIdMiddleware.HeaderName);
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
app.UseMiddleware<CorrelationIdMiddleware>();

// Registered outside the exception handler so it logs the final, handled status code.
app.UseSerilogRequestLogging(options =>
{
    options.GetLevel = (http, elapsed, ex) =>
        ex is not null || http.Response.StatusCode >= 500 ? LogEventLevel.Error
        : http.Response.StatusCode >= 400 ? LogEventLevel.Warning
        : elapsed > 1000 ? LogEventLevel.Warning
        // Health probes fire constantly and would otherwise bury everything else.
        : http.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose
        : LogEventLevel.Information;
    options.EnrichDiagnosticContext = (diag, http) =>
    {
        diag.Set("RequestHost", http.Request.Host.Value ?? "-");
        diag.Set("UserAgent", http.Request.Headers.UserAgent.ToString());
        diag.Set("CorrelationId", http.Items[CorrelationIdMiddleware.HeaderName] as string ?? "-");
    };
});

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Hardens every response. This is a JSON API, so default-src 'none' is correct — except for the
// Swagger UI, which loads its own scripts and styles and is only mapped in Development.
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    if (!context.Request.Path.StartsWithSegments("/swagger"))
    {
        context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    }

    await next();
});

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

try
{
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "gameshelf-api terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

// Exposes the entry point to WebApplicationFactory<Program> in the test projects.
public partial class Program;
