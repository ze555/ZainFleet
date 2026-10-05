FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ZainFleet/ZainFleet.csproj ZainFleet/
RUN dotnet restore ZainFleet/ZainFleet.csproj
COPY ZainFleet/ ZainFleet/
RUN dotnet publish ZainFleet/ZainFleet.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV PORT=8080
ENV TCP_PORT=5000
EXPOSE 8080 5000
USER 1654
ENTRYPOINT ["dotnet", "ZainFleet.dll"]
