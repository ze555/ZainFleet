using ZainFleet.Protocol;
using ZainFleet.Repositories;
using ZainFleet.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

var httpPort = builder.Configuration["PORT"] ?? "8080";
builder.WebHost.UseUrls(builder.Configuration["ASPNETCORE_URLS"] ?? $"http://0.0.0.0:{httpPort}");

// Register replaceable repositories and services
builder.Services.AddSingleton<IDeviceRepository, InMemoryDeviceRepository>();
builder.Services.AddSingleton<ITelemetryRepository, InMemoryTelemetryRepository>();
builder.Services.AddSingleton<DeviceManager>();
builder.Services.AddSingleton<ITeltonikaPacketParser, TeltonikaPacketParser>();
builder.Services.AddHostedService<TcpServer>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.UseRouting();

app.MapRazorPages();

// Management and API endpoints
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapGet("/api/devices", (IDeviceRepository devices) => Results.Ok(devices.GetAll()));
app.MapGet("/api/devices/{imei}", (string imei, IDeviceRepository devices) =>
    devices.Get(imei) is { } device ? Results.Ok(device) : Results.NotFound());
app.MapGet("/api/devices/{imei}/latest", async (string imei, ITelemetryRepository telemetry, CancellationToken ct) =>
{
    var latest = await telemetry.GetLatestAsync(imei, ct);
    return latest is null ? Results.NotFound() : Results.Ok(latest);
});

app.Run();
