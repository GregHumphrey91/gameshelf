# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first so the layer is cached unless the csproj changes.
COPY src/GameShelf.Api/GameShelf.Api.csproj src/GameShelf.Api/
RUN dotnet restore src/GameShelf.Api/GameShelf.Api.csproj

COPY src/GameShelf.Api/ src/GameShelf.Api/
RUN dotnet publish src/GameShelf.Api/GameShelf.Api.csproj -c Release -o /app/publish --no-restore

# ---- runtime --------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Run as the non-root user the base image provides.
USER $APP_UID

ENTRYPOINT ["dotnet", "GameShelf.Api.dll"]
