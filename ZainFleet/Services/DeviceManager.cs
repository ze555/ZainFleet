using ZainFleet.Models;
using ZainFleet.Repositories;

namespace ZainFleet.Services;

public sealed class DeviceManager(IDeviceRepository devices, ITelemetryRepository telemetry)
{
    public DeviceInfo Connected(string imei) => devices.Upsert(imei, DateTimeOffset.UtcNow, true);

    public DeviceInfo Disconnected(string imei) => devices.Upsert(imei, DateTimeOffset.UtcNow, false);

    public async ValueTask RecordAsync(string imei, AvlRecord record, CancellationToken cancellationToken)
    {
        await telemetry.StoreAsync(imei, record, cancellationToken);
        devices.Upsert(imei, DateTimeOffset.UtcNow, true);
    }
}