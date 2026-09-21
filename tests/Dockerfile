# syntax=docker/dockerfile:1
#
# Backend test runner for docker-compose.test.yml. Build context is the repository root.
# Sources are COPY'd, never bind-mounted, so host bin/obj output cannot leak into the container build.

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS test
WORKDIR /src
ENV DOTNET_NOLOGO=true \
    DOTNET_CLI_TELEMETRY_OPTOUT=true

# Restore first so the package layer is cached until a csproj changes.
COPY src/GameShelf.Api/GameShelf.Api.csproj src/GameShelf.Api/
COPY tests/GameShelf.Api.Tests/GameShelf.Api.Tests.csproj tests/GameShelf.Api.Tests/
COPY tests/GameShelf.Api.IntegrationTests/GameShelf.Api.IntegrationTests.csproj tests/GameShelf.Api.IntegrationTests/
RUN dotnet restore tests/GameShelf.Api.Tests/GameShelf.Api.Tests.csproj \
 && dotnet restore tests/GameShelf.Api.IntegrationTests/GameShelf.Api.IntegrationTests.csproj

COPY src/GameShelf.Api/ src/GameShelf.Api/
COPY tests/ tests/
# The committed API contract, which OpenApiContractTests compares the running API against.
COPY infra/openapi.json infra/openapi.json

# Compile at image-build time: a build error fails `docker compose up --build` immediately,
# and the entrypoint runs `dotnet test --no-build`, so the suites start the moment SQL Server is healthy.
RUN dotnet build tests/GameShelf.Api.Tests/GameShelf.Api.Tests.csproj -c Release --no-restore \
 && dotnet build tests/GameShelf.Api.IntegrationTests/GameShelf.Api.IntegrationTests.csproj -c Release --no-restore \
 && chmod +x tests/docker-entrypoint.sh

ENTRYPOINT ["/src/tests/docker-entrypoint.sh"]
