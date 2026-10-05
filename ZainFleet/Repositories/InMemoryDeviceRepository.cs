using System.Collections.Concurrent;
using ZainFleet.Models;

namespace ZainFleet.Repositories;

public sealed class InMemoryDeviceRepository : IDeviceRepository
{
    private readonly ConcurrentDictionary<string, DeviceInfo> _devices = new(StringComparer.Ordinal);

    public DeviceInfo Upsert(string imei, DateTimeOffset seenAt, bool connected) =>
        _devices.AddOrUpdate(
            imei,
            _ => new DeviceInfo(imei, seenAt, seenAt, connected),
            (_, existing) => existing with { LastSeen = seenAt, Connected = connected });

    public DeviceInfo? Get(string imei) => _devices.TryGetValue(imei, out var device) ? device : null;

    public IReadOnlyCollection<DeviceInfo> GetAll() => _devices.Values.ToArray();
}